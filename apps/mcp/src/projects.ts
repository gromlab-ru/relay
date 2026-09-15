import { dirname } from "node:path";
import { startServer } from "@tasks/server-runtime";
import { createHttpBackend } from "@tasks/project-runtime/backend/http";
import type { Backend } from "@tasks/project-runtime/backend/types";
import { entryTarget, readConfiguration, resolveProject } from "@tasks/project-runtime/config";
import type { ProjectTarget } from "@tasks/project-runtime/config";
import { invariant } from "@tasks/core/shared/errors";

type ApiServer = Awaited<ReturnType<typeof startServer>>;
interface LocalApi {
  ready: Promise<ApiServer>;
  users: number;
  retired: boolean;
}

/** MCP всегда использует SDK. Локальный runtime нужен только при отсутствии URL проекта. */
export class Projects {
  private readonly apis = new Map<string, LocalApi>();
  private readonly closing = new Set<Promise<void>>();
  private readonly operations = new Set<Promise<unknown>>();
  private stopped = false;

  constructor(readonly configPath: string) {}

  async source() {
    const source = await readConfiguration(dirname(this.configPath), this.configPath);
    const paths =
      source.kind === "project"
        ? [source.value.server.url ? undefined : source.path]
        : Object.entries(source.value.projects).map(([name, entry]) =>
            entry.serverUrl ? undefined : entryTarget(source.path, name, entry).configPath,
          );
    for (const [path, api] of this.apis) {
      if (!paths.includes(path)) {
        this.apis.delete(path);
        api.retired = true;
        if (!api.users) this.dispose(api);
      }
    }
    return source;
  }

  private dispose(api: LocalApi) {
    const closed = api.ready
      .then(
        (server) => server.close(),
        () => {},
      )
      .then(() => {});
    this.closing.add(closed);
    void closed.finally(() => this.closing.delete(closed)).catch(() => {});
  }

  withBackend<T>(
    project: string | undefined,
    action: (backend: Backend, target: ProjectTarget) => Promise<T>,
  ): Promise<T> {
    const operation = this.run(project, action);
    this.operations.add(operation);
    void operation.finally(() => this.operations.delete(operation)).catch(() => {});
    return operation;
  }

  private async run<T>(
    project: string | undefined,
    action: (backend: Backend, target: ProjectTarget) => Promise<T>,
  ): Promise<T> {
    invariant(!this.stopped, "MCP_STOPPING", "MCP завершает работу");
    const source = await this.source();
    const target = await resolveProject(source, project);
    if (target.serverUrl) {
      const previous = target.configPath ? this.apis.get(target.configPath) : undefined;
      if (previous && target.configPath) {
        this.apis.delete(target.configPath);
        previous.retired = true;
        if (!previous.users) this.dispose(previous);
      }
      return action(await createHttpBackend(target.serverUrl), target);
    }
    const path = target.configPath;
    invariant(path, "LOCAL_CONFIG_REQUIRED", "Проекту требуется config, path или serverUrl");
    let api = this.apis.get(path);
    if (!api) {
      api = {
        ready: startServer({
          cwd: dirname(path),
          config: path,
          port: 0,
          actor: "mcp",
          webRoot: false,
        }),
        users: 0,
        retired: false,
      };
      this.apis.set(path, api);
    }
    api.users++;
    try {
      const server = await api.ready;
      return await action(await createHttpBackend(server.url), target);
    } catch (error) {
      // Неудачный запуск можно повторить после исправления конфигурации.
      if (
        await api.ready.then(
          () => false,
          () => true,
        )
      ) {
        if (this.apis.get(path) === api) this.apis.delete(path);
        api.retired = true;
      }
      throw error;
    } finally {
      api.users--;
      if (api.retired && !api.users) this.dispose(api);
    }
  }

  async close() {
    this.stopped = true;
    await Promise.allSettled(this.operations);
    for (const api of this.apis.values()) this.dispose(api);
    this.apis.clear();
    await Promise.all(this.closing);
  }
}
