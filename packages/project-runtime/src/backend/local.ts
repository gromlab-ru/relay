import { TaskService } from "@relay/core/application/tasks/service";
import { claimTask, releaseTask, changeDependency } from "@relay/core/application/tasks/assignment";
import { ProjectQueries } from "@relay/core/application/queries/project";
import { TaskQueries } from "@relay/core/application/queries/tasks";
import { CommentService } from "@relay/core/application/comments";
import { LogService } from "@relay/core/application/logs/service";
import { validateWorkspace } from "@relay/core/application/validate";
import { openWorkspace } from "@relay/core/storage/workspace";
import type { Backend } from "./types.js";
import { LifecycleQueries } from "@relay/core/application/project/queries";
import { ProjectService } from "@relay/core/application/project/service";
import { ProductQueries } from "@relay/core/application/product/queries";
import { BoardTasksService } from "@relay/core/application/board-tasks/service";
import { BoardsService } from "@relay/core/application/boards/service";

export async function createLocalBackend(cwd: string, config?: string): Promise<Backend> {
  const workspace = await openWorkspace(cwd, config);
  const service = new TaskService(workspace);
  const queries = new ProjectQueries(workspace);
  const lifecycle = new LifecycleQueries(workspace);
  return {
    kind: "local",
    boardTasks: new BoardTasksService(workspace),
    boards: new BoardsService(workspace),
    product: new ProductQueries(workspace),
    workspace,
    localWorkspace: workspace,
    lifecycle: {
      state: () => lifecycle.state(),
      context: () => lifecycle.context(),
      briefing: (id) => lifecycle.briefing(id),
      changes: (id) => lifecycle.changes(id),
      save: (input, actor) => new ProjectService(workspace).save(input, actor),
    },
    tasks: {
      workspace,
      list: (input) => queries.list(input),
      document: (id) => queries.document(id),
      links: (id) => queries.links(id),
      tree: (id, depth) => queries.tree(id, depth),
      groups: () => queries.groups(),
      overview: (id, input) => new TaskQueries(workspace).overview(id, input),
      markdown: async (id, field) => (await service.repository.resolve(id))[field],
      create: (input, actor) => service.create(input, actor),
      update: (id, patch, options) => service.update(id, patch, options),
      claim: (id, options, status) => claimTask(service, id, options, status),
      release: (id, options, force) => releaseTask(service, id, options, force),
      dependency: (id, dependency, add, options) =>
        changeDependency(service, id, dependency, add, options),
    },
    comments: new CommentService(workspace),
    logs: new LogService(workspace),
    validate: () => validateWorkspace(workspace),
  };
}
