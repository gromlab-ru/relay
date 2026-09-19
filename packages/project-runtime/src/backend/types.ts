import type { Config } from "@relay/core/domain/config";
import type { Task, TaskFields, TaskPatch } from "@relay/core/domain/task";
import type { TaskReference } from "@relay/core/shared/ids";
import type { MutationOptions } from "@relay/core/application/tasks/service";
import type { ProjectQueries } from "@relay/core/application/queries/project";
import type { TaskQueries } from "@relay/core/application/queries/tasks";
import type { CommentService } from "@relay/core/application/comments";
import type { LogService } from "@relay/core/application/logs/service";
import type { validateWorkspace } from "@relay/core/application/validate";
import type { Workspace } from "@relay/core/storage/workspace";
import type { LifecycleQueries } from "@relay/core/application/project/queries";
import type { ProjectService } from "@relay/core/application/project/service";
import type { ProductQueries } from "@relay/core/application/product/queries";
import type { BoardTasksService } from "@relay/core/application/board-tasks/service";
import type { BoardsService } from "@relay/core/application/boards/service";

export interface WorkspaceInfo {
  config: Config;
  configPath: string;
  root: string;
}
export type SavedTask = Pick<Task, "id" | "revision">;

/** Интерфейсы приложений зависят от операций и read models, а не от файлового репозитория. */
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
  boardTasks: Pick<
    BoardTasksService,
    "list" | "get" | "links" | "create" | "update" | "move" | "link"
  >;
  boards: Pick<BoardsService, "list" | "get">;
  product: Pick<ProductQueries, "state" | "mutate" | "overview" | "list" | "context">;
  lifecycle: Pick<LifecycleQueries, "state" | "context" | "briefing" | "changes"> &
    Pick<ProjectService, "save">;
  kind: "local" | "http";
  workspace: WorkspaceInfo;
  tasks: TasksBackend;
  comments: Pick<CommentService, "add" | "get" | "records">;
  logs: Pick<LogService, "add" | "get" | "records">;
  validate(): ReturnType<typeof validateWorkspace>;
  localWorkspace?: Workspace;
}
