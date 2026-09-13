import { resolve } from "node:path";

// Resolve user paths before Turbo/npm changes the task's working directory.
if (process.env.TASKS_CONFIG) {
  process.env.TASKS_CONFIG = resolve(
    process.env.INIT_CWD ?? process.cwd(),
    process.env.TASKS_CONFIG,
  );
}
