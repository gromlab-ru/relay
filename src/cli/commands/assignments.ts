import type { Command } from "commander";
import { claimTask, releaseTask, changeDependency } from "../../application/tasks/assignment.js";
import { action, argument, changed, mutation } from "../context.js";
import type { Runtime } from "../context.js";
import { revisionOption } from "../options.js";

export function registerAssignments(program: Command, runtime: Runtime): void {
  const status = revisionOption(
    program.command("status <id> <status>").description("Установить статус задачи"),
  );
  action(status, runtime, async (context) =>
    changed(
      await context.tasks.update(
        argument(status),
        { status: argument(status, 1) },
        mutation(context, status),
      ),
    ),
  );

  const assign = revisionOption(
    program.command("assign <id> <assignee>").description("Явно назначить исполнителя"),
  );
  action(assign, runtime, async (context) =>
    changed(
      await context.tasks.update(
        argument(assign),
        { assignee: argument(assign, 1) },
        mutation(context, assign),
      ),
    ),
  );

  const claim = revisionOption(
    program.command("claim <id>").description("Атомарно занять свободную доступную задачу"),
  );
  action(claim, runtime, async (context) =>
    changed(await claimTask(context.tasks, argument(claim), mutation(context, claim))),
  );

  const release = revisionOption(
    program.command("release <id>").description("Снять назначение задачи"),
  ).option("--force", "Явно снять назначение другого исполнителя");
  action(release, runtime, async (context) =>
    changed(
      await releaseTask(
        context.tasks,
        argument(release),
        mutation(context, release),
        !!release.opts<{ force?: boolean }>().force,
      ),
    ),
  );

  const deps = program.command("deps").description("Управление зависимостями: A зависит от B");
  for (const verb of ["add", "remove"] as const) {
    const command = revisionOption(
      deps
        .command(`${verb} <id> <dependency>`)
        .description(verb === "add" ? "Добавить зависимость" : "Удалить зависимость"),
    );
    action(command, runtime, async (context) =>
      changed(
        await changeDependency(
          context.tasks,
          argument(command),
          argument(command, 1),
          verb === "add",
          mutation(context, command),
        ),
      ),
    );
  }
}
