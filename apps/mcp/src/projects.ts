import { createHttpBackend } from "@relay/project-runtime/backend/http";
import { createServerApi } from "@relay/project-runtime/backend/server";
import type { Backend } from "@relay/project-runtime/backend/types";
import type { ProjectTarget } from "@relay/project-runtime/config";
import { invariant } from "@relay/core/shared/errors";

/** MCP знает только URL Relay Server; реестр и файлы принадлежат серверу. */
export class Projects {
  readonly api;
  private stopped = false;
  constructor(readonly url: string) {
    this.api = createServerApi(url);
  }
  async source() {
    return (await this.api.server.getServerContext()).data;
  }
  async withBackend<T>(
    project: string | undefined,
    action: (backend: Backend, target: ProjectTarget) => Promise<T>,
  ): Promise<T> {
    invariant(!this.stopped, "MCP_STOPPING", "MCP завершает работу");
    const source = await this.source();
    invariant(
      project !== undefined || source.mode === "local",
      "PROJECT_REQUIRED",
      "В workspace укажите project из projects_list",
    );
    const selected = source.projects.find((item) =>
      project === undefined
        ? item.id === source.defaultProject
        : item.key === project || item.id === project,
    );
    invariant(selected, "PROJECT_NOT_FOUND", `Проект ${project ?? "local"} не найден`, 3);
    return action(await createHttpBackend(this.url, selected.id), {
      project: selected.key,
      serverUrl: this.url,
    });
  }
  async close() {
    this.stopped = true;
  }
}
