import type { Config } from "@relay/core/domain/config";
import type { validateWorkspace } from "@relay/core/application/validate";
import type { Workspace } from "@relay/core/storage/workspace";
import type { ProductQueries } from "@relay/core/application/product/queries";
import type { BoardTasksService } from "@relay/core/application/board-tasks/service";
import type { BoardsService } from "@relay/core/application/boards/service";
import type { GraphService } from "@relay/core/application/graph/service";
import type { EntityEngine } from "@relay/core/application/entities/service";

export interface WorkspaceInfo {
  config: Config;
  configPath: string;
  root: string;
}
export interface Backend {
  entities: Pick<
    EntityEngine,
    | "types"
    | "describe"
    | "list"
    | "get"
    | "resolve"
    | "keys"
    | "keySpaces"
    | "history"
    | "create"
    | "update"
    | "rename"
    | "moveTask"
    | "linkTask"
  >;
  graph: Pick<GraphService, "read" | "mutate" | "history">;
  boardTasks: Pick<
    BoardTasksService,
    "list" | "get" | "links" | "create" | "update" | "move" | "link"
  >;
  boards: Pick<BoardsService, "list" | "get">;
  product: Pick<
    ProductQueries,
    | "state"
    | "mutate"
    | "overview"
    | "list"
    | "context"
    | "entities"
    | "entity"
    | "updateImplementation"
  >;
  kind: "local" | "http";
  workspace: WorkspaceInfo;
  validate(): ReturnType<typeof validateWorkspace>;
  localWorkspace?: Workspace;
}
