import { TaskService } from "@tasks/core/application/tasks/service";
import { claimTask, releaseTask, changeDependency } from "@tasks/core/application/tasks/assignment";
import { ProjectQueries } from "@tasks/core/application/queries/project";
import { TaskQueries } from "@tasks/core/application/queries/tasks";
import { CommentService } from "@tasks/core/application/comments";
import { LogService } from "@tasks/core/application/logs/service";
import { validateWorkspace } from "@tasks/core/application/validate";
import { openWorkspace } from "@tasks/core/storage/workspace";
import type { Backend } from "./types.js";
import { LifecycleQueries } from "@tasks/core/application/project/queries";
import { ProjectService } from "@tasks/core/application/project/service";

export async function createLocalBackend(cwd: string, config?: string): Promise<Backend> {
  const workspace = await openWorkspace(cwd, config);
  const service = new TaskService(workspace);
  const queries = new ProjectQueries(workspace);
  const lifecycle = new LifecycleQueries(workspace);
  return {
    kind: "local",
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
