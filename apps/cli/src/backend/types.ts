import type { Config } from "@tasks/core/domain/config";
import type { Task, TaskFields, TaskPatch } from "@tasks/core/domain/task";
import type { TaskReference } from "@tasks/core/shared/ids";
import type { MutationOptions } from "@tasks/core/application/tasks/service";
import type { ProjectQueries } from "@tasks/core/application/queries/project";
import type { TaskQueries } from "@tasks/core/application/queries/tasks";
import type { CommentService } from "@tasks/core/application/comments";
import type { LogService } from "@tasks/core/application/logs/service";
import type { validateWorkspace } from "@tasks/core/application/validate";
import type { Workspace } from "@tasks/core/storage/workspace";

export interface WorkspaceInfo {
  config: Config;
  configPath: string;
  root: string;
}
export type SavedTask = Pick<Task, "id" | "revision">;

/** Команды зависят от операций и read models; файлового репозитория в этом контракте нет. */
export interface TasksBackend {
  workspace: WorkspaceInfo;
  list: ProjectQueries["list"];
  document: ProjectQueries["document"];
  links: ProjectQueries["links"];
  tree: ProjectQueries["tree"];
  groups: ProjectQueries["groups"];
  overview: TaskQueries["overview"];
  markdown(reference: TaskReference, field: "description" | "summary"): Promise<string[]>;
  create(input: Partial<TaskFields> & { title: string }, actor: string): Promise<SavedTask>;
  update(reference: TaskReference, patch: TaskPatch, options: MutationOptions): Promise<SavedTask>;
  claim(reference: TaskReference, options: MutationOptions, status?: string): Promise<SavedTask>;
  release(reference: TaskReference, options: MutationOptions, force: boolean): Promise<SavedTask>;
  dependency(
    reference: TaskReference,
    dependency: TaskReference,
    add: boolean,
    options: MutationOptions,
  ): Promise<SavedTask>;
}

export interface Backend {
  kind: "local" | "http";
  workspace: WorkspaceInfo;
  tasks: TasksBackend;
  comments: Pick<CommentService, "add" | "get" | "records">;
  logs: Pick<LogService, "add" | "get" | "records">;
  validate(): ReturnType<typeof validateWorkspace>;
  localWorkspace?: Workspace;
}
