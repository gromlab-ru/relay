import { asAppError, invariant } from "../shared/errors.js";
import type { Workspace } from "../storage/workspace.js";
import { readEntityCatalog } from "./entities/catalog.js";
import { BoardTasksService } from "./board-tasks/service.js";
import { GraphService } from "./graph/service.js";

/** Проверяет действующие записи и связи под единой блокировкой проекта. */
export async function validateWorkspace(workspace: Workspace) {
  return workspace.locked(async (owned) => {
    const issues: { code: string; message: string }[] = [];
    const check = async <T>(operation: () => Promise<T>) => {
      try {
        return await operation();
      } catch (error) {
        const failure = asAppError(error);
        issues.push({ code: failure.code, message: failure.message });
        return undefined;
      }
    };
    const catalog = await check(() => readEntityCatalog(workspace, owned));
    const tasks = await check(() => new BoardTasksService(workspace).list({ limit: 1 }));
    await check(() => new GraphService(workspace).read({ limit: 1 }));
    invariant(
      issues.length === 0,
      "VALIDATION_FAILED",
      "Обнаружены нарушения целостности",
      5,
      issues,
    );
    return {
      valid: true,
      entities: catalog?.entries.length ?? 0,
      tasks: tasks?.total ?? 0,
      boards: catalog?.entries.filter((entry) => entry.ref.kind === "board").length ?? 0,
    };
  });
}
