import { resolve } from "node:path";

// Разрешаем пользовательские пути до смены рабочего каталога через Turbo/pnpm.
if (process.env.TASKS_CONFIG) {
  process.env.TASKS_CONFIG = resolve(
    process.env.INIT_CWD ?? process.cwd(),
    process.env.TASKS_CONFIG,
  );
}
