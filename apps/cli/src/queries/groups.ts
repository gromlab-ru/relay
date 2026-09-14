import type { TasksBackend } from "../backend/types.js";
import { paginate } from "./pagination.js";
import type { PageOptions } from "./pagination.js";
import { groupsText } from "../presentation/project.js";

export async function listGroups(service: TasksBackend, page: PageOptions) {
  return paginate(
    await service.groups(),
    (group) => group.name,
    { command: "group.list" },
    page,
    false,
    groupsText,
  );
}
