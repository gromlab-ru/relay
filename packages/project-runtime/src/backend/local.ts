import { validateWorkspace } from "@relay/core/application/validate";
import { openWorkspace } from "@relay/core/storage/workspace";
import type { Backend } from "./types.js";
import { ProductQueries } from "@relay/core/application/product/queries";
import { BoardTasksService } from "@relay/core/application/board-tasks/service";
import { BoardsService } from "@relay/core/application/boards/service";
import { GraphService } from "@relay/core/application/graph/service";
import { EntityEngine } from "@relay/core/application/entities/service";
import { ProgressService } from "@relay/core/application/progress/service";

export async function createLocalBackend(cwd: string, config?: string): Promise<Backend> {
  const workspace = await openWorkspace(cwd, config);
  return {
    kind: "local",
    progress: new ProgressService(workspace),
    entities: new EntityEngine(workspace),
    graph: new GraphService(workspace),
    boardTasks: new BoardTasksService(workspace),
    boards: new BoardsService(workspace),
    product: new ProductQueries(workspace),
    workspace: {
      config: workspace.config,
      configPath: workspace.configPath,
      root: workspace.dataRoot,
    },
    localWorkspace: workspace,
    validate: () => validateWorkspace(workspace),
  };
}
