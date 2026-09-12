import type { Command } from "commander";
import { validateWorkspace } from "../../application/validate.js";
import { listGroups } from "../../application/groups.js";
import { initialize } from "../../storage/workspace.js";
import { action, outputOptions } from "../context.js";
import type { GlobalOptions, Runtime } from "../context.js";
import { printResult } from "../output.js";
import { pageFrom, pageOptions } from "../options.js";
import { configText, initializedText } from "../../presentation/project.js";

export function registerProject(program: Command, runtime: Runtime): void {
  const init = program
    .command("init")
    .description("Создать конфигурацию и хранилище")
    .option("--storage <path>", "Путь к данным относительно конфига", ".tasks");
  init.action(async () => {
    const globals = init.optsWithGlobals<GlobalOptions>();
    const workspace = await initialize(
      runtime.cwd,
      init.opts<{ storage: string }>().storage,
      globals.config,
    );
    runtime.output = outputOptions(runtime, globals, workspace.config.output);
    printResult(
      runtime.stdout,
      {
        data: { configPath: workspace.configPath, storageDir: workspace.root },
        text: (options) => initializedText(workspace.configPath, workspace.root, options),
      },
      runtime.output,
    );
  });
  const validate = program
    .command("validate")
    .description("Проверить задачи, комментарии, отчёты и граф связей");
  action(validate, runtime, (context) => validateWorkspace(context.workspace));

  const config = program.command("config").description("Настройки проекта");
  const configGet = config
    .command("get")
    .description("Посмотреть доступные статусы и настройки через CLI");
  action(configGet, runtime, async (context) => ({
    data: context.workspace.config,
    meta: { configPath: context.workspace.configPath, storagePath: context.workspace.root },
    text: (options) =>
      configText(
        context.workspace.config,
        context.workspace.configPath,
        context.workspace.root,
        options,
      ),
  }));

  const group = program.command("group").description("Группы задач");
  const groups = pageOptions(
    group.command("list").description("Список групп и прогресс выполнения"),
  );
  action(groups, runtime, (context) => listGroups(context.tasks, pageFrom(context, groups)));
}
