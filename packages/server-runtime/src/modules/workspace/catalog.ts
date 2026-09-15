import { createHash } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import { realpath } from "node:fs/promises";
import type { ContextResponse, RelayProject, ServerContextResponse } from "@tasks/contracts";
import { actorSchema, parse } from "@tasks/core/domain/validation";
import { AppError, invariant } from "@tasks/core/shared/errors";
import { openWorkspace, readWorkspaceConfig } from "@tasks/core/storage/workspace";
import type { Workspace } from "@tasks/core/storage/workspace";
import { configurationMode, entryTarget, readConfiguration } from "@tasks/project-runtime/config";
import { registerProject, unregisterProject } from "@tasks/project-runtime/registry";
import type { ProjectEntry } from "@tasks/project-runtime/config";

export interface WorkspaceOptions {
  cwd: string;
  configPath: string;
  actor: string;
  mode?: "local" | "workspace";
}

function projectName(path: string) {
  const directory = dirname(path);
  return basename(basename(directory) === ".relay" ? dirname(directory) : directory);
}

/** Неизменяемый выбор проекта; безопасен для параллельных запросов и наблюдателей. */
export class ProjectContext {
  constructor(
    readonly options: WorkspaceOptions,
    readonly projectId: string,
  ) {}

  async open(): Promise<Workspace> {
    try {
      return await openWorkspace(this.options.cwd, this.options.configPath);
    } catch (error) {
      if (error instanceof AppError && error.code === "VALIDATION_ERROR")
        throw new AppError("INVALID_CONFIG", "Конфигурация проекта некорректна", 5, error.details);
      throw error;
    }
  }

  context(workspace: Workspace): ContextResponse {
    return {
      project: projectName(workspace.configPath),
      capabilities: ["cli-http-v1", "record-request-v1", "relay-projects-v1"],
      projectId: this.projectId,
      configPath: workspace.configPath,
      storagePath: workspace.root,
      actor: this.options.actor,
      config: workspace.config,
    };
  }
}

/** Владелец реестра сервера. Каждое разрешение использует актуальную конфигурацию. */
export class ProjectCatalog {
  private readonly contexts = new Map<string, ProjectContext>();
  constructor(readonly options: WorkspaceOptions) {}

  source() {
    return readConfiguration(this.options.cwd, this.options.configPath);
  }

  async entries() {
    const source = await this.source();
    const entries =
      source.kind === "project"
        ? [{ key: "local", configPath: source.path }]
        : Object.entries(source.value.projects).map(([key, entry]) => {
            const target = entryTarget(source.path, key, entry);
            invariant(
              target.configPath,
              "PROJECT_CONFIG_REQUIRED",
              `Проект ${key}: требуется локальный path или config`,
            );
            return { key, configPath: target.configPath };
          });
    return { source, entries };
  }

  async at(configPath: string): Promise<ProjectContext> {
    const path = await realpath(configPath);
    const { config } = await readWorkspaceConfig(dirname(path), path);
    const id = config.projectId ?? createHash("sha256").update(path).digest("hex").slice(0, 24);
    const context = new ProjectContext({ ...this.options, configPath: path }, id);
    this.contexts.set(resolve(configPath), context);
    return context;
  }

  async context(): Promise<ServerContextResponse> {
    const { source, entries } = await this.entries();
    const projects: RelayProject[] = await Promise.all(
      entries.map(async ({ key, configPath }) => {
        try {
          const project = await this.at(configPath);
          return {
            key,
            id: project.projectId,
            name: projectName(configPath),
            configPath: project.options.configPath,
            available: true,
          };
        } catch (error) {
          return {
            key,
            id: key,
            name: key,
            configPath,
            available: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );
    for (const project of projects) {
      if (
        projects.some((other) => other.id === project.id && other.configPath !== project.configPath)
      ) {
        project.available = false;
        project.error = "DUPLICATE_PROJECT_ID: разные базы имеют одинаковый projectId";
      }
    }
    return {
      mode: configurationMode(source),
      configPath: source.path,
      projects,
      defaultProject: source.kind === "project" ? projects[0]!.id : null,
    };
  }

  private async unique(context: ProjectContext, entries: { configPath: string }[]) {
    for (const entry of entries) {
      const other = await this.at(entry.configPath).catch(() => undefined);
      invariant(
        !other ||
          other.projectId !== context.projectId ||
          other.options.configPath === context.options.configPath,
        "DUPLICATE_PROJECT_ID",
        "Разные базы должны иметь разные projectId",
        4,
      );
    }
    return context;
  }

  async select(selector?: string): Promise<ProjectContext> {
    if (this.options.mode === "local") {
      const context =
        this.contexts.get(resolve(this.options.configPath)) ??
        (await this.at(this.options.configPath));
      invariant(
        selector === undefined || selector === "local" || selector === context.projectId,
        "PROJECT_NOT_FOUND",
        `Проект ${selector} не зарегистрирован`,
        3,
      );
      return context;
    }
    const { source, entries } = await this.entries();
    invariant(
      selector !== undefined || source.kind === "project",
      "PROJECT_REQUIRED",
      "В workspace укажите проект",
    );
    if (selector === undefined) return this.at(entries[0]!.configPath);
    const direct = entries.find(({ key }) => key === selector);
    if (direct) return this.unique(await this.at(direct.configPath), entries);
    for (const entry of entries) {
      const context = await this.at(entry.configPath).catch(() => undefined);
      if (context?.projectId === selector) return this.unique(context, entries);
    }
    throw new AppError("PROJECT_NOT_FOUND", `Проект ${selector} не зарегистрирован`, 3);
  }

  async register(key: string, entry: ProjectEntry, replace: boolean) {
    const source = await this.source();
    invariant(source.kind === "registry", "WORKSPACE_REQUIRED", "Регистрация доступна в workspace");
    const target = entryTarget(source.path, key, entry);
    invariant(
      target.configPath,
      "PROJECT_CONFIG_REQUIRED",
      "Укажите локальный path или config проекта",
    );
    const config = await readConfiguration(dirname(source.path), resolve(target.configPath));
    invariant(
      config.kind === "project",
      "PROJECT_CONFIG_REQUIRED",
      "Запись должна ссылаться на .relay/config.json проекта",
    );
    const { entries } = await this.entries();
    await this.unique(
      await this.at(target.configPath),
      entries.filter((entry) => entry.key !== key),
    );
    return registerProject(source.path, key, entry, replace);
  }

  async unregister(key: string) {
    const source = await this.source();
    invariant(
      source.kind === "registry",
      "WORKSPACE_REQUIRED",
      "Удаление регистрации доступно в workspace",
    );
    return unregisterProject(source.path, key);
  }

  actor(override?: string) {
    return parse(actorSchema, override ?? this.options.actor, "автор запроса");
  }
}
