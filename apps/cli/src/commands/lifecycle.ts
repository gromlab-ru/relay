import type { Command } from "commander";
import { saveProjectRecordSchema } from "@relay/core/domain/project";
import { parseTaskId } from "@relay/core/shared/ids";
import { AppError, invariant } from "@relay/core/shared/errors";
import { parse } from "@relay/core/domain/validation";
import { author } from "../context.js";
import type { Runtime } from "../context.js";
import { commandGroup, registerCommand } from "../command.js";

/** Проектные документы и готовый контекст доступны в обоих транспортных режимах. */
export function registerLifecycle(program: Command, runtime: Runtime): void {
  const group = commandGroup(program, {
    name: "project",
    description: "Паспорт, планы, знания, исполнения, проверки и релизы",
    details:
      "Все документы принадлежат выбранному проекту. Запись требует автора; обновление — прочитанной revision.",
    examples: [
      ["relay-cli project context", "Контекст оркестратора"],
      ["relay-cli project briefing 1", "Поручение работнику"],
      [
        "relay-cli project save --file change.json --actor orchestrator",
        "Сохранить проектный документ",
      ],
    ],
  });
  for (const name of ["state", "context"] as const)
    registerCommand(group, runtime, {
      name,
      description:
        name === "state" ? "Полное состояние проекта" : "Компактный контекст оркестратора",
      details:
        "Читает согласованный снимок. Для большой базы используйте project records и project get.",
      examples: [
        [`relay-cli project ${name} --format json`, "Получить структурированное состояние"],
      ],
      run: async (context) => ({ data: await context.backend.lifecycle[name]() }),
    });
  registerCommand<{ kind?: string }>(group, runtime, {
    name: "records",
    description: "Краткий список проектных документов",
    details:
      "Виды: passport, plan, stage, requirement, knowledge, task, run, check, review, question, release, deployment, checkpoint.",
    examples: [["relay-cli project records --kind plan", "Посмотреть планы"]],
    configure: (command) => command.option("--kind <kind>", "Вид документа"),
    run: async (context, input) => ({
      data: {
        items: (await context.backend.lifecycle.state()).records
          .filter((record) => !input.options.kind || record.fields.kind === input.options.kind)
          .map(({ id, revision, fields, updatedAt }) => ({
            id,
            revision,
            kind: fields.kind,
            title: fields.title,
            updatedAt,
          })),
      },
    }),
  });
  registerCommand(group, runtime, {
    name: "get <id>",
    description: "Прочитать проектный документ",
    arguments: { id: "ID из project records" },
    details: "Возвращает поля, ревизию, авторство и историю документа.",
    examples: [["relay-cli project get passport", "Прочитать паспорт"]],
    run: async (context, input) => {
      const record = (await context.backend.lifecycle.state()).records.find(
        (item) => item.id === input.argument(),
      );
      invariant(record, "PROJECT_RECORD_NOT_FOUND", "Документ не найден", 3);
      return { data: record };
    },
  });
  registerCommand(group, runtime, {
    name: "briefing <id>",
    description: "Собрать поручение работнику",
    arguments: { id: "Числовой ID задачи" },
    details: "Включает цель плана, этап, требования, знания, границы и критерии задачи.",
    examples: [["relay-cli project briefing 1", "Получить Markdown-поручение"]],
    run: async (context, input) => {
      const data = await context.backend.lifecycle.briefing(parseTaskId(input.argument()));
      return { data, text: data.markdown };
    },
  });
  registerCommand(group, runtime, {
    name: "changes <id>",
    description: "Изменения после контрольной точки",
    arguments: { id: "ID контрольной точки" },
    details: "Сравнивает текущие ревизии задач и документов с сохранённым снимком.",
    examples: [["relay-cli project changes checkpoint_<id>", "Продолжить работу после перерыва"]],
    run: async (context, input) => ({
      data: await context.backend.lifecycle.changes(input.argument()),
    }),
  });
  registerCommand<{ json?: string; file?: string }>(group, runtime, {
    name: "save",
    description: "Создать или обновить документ проекта",
    details:
      'JSON: {"fields":{"kind":"plan","title":"MVP"}}. Для обновления передайте id и ifRevision. Поля документа передаются целиком; отсутствующие необязательные значения получают defaults. Для повторяемого создания используйте requestId.',
    examples: [
      [
        `relay-cli project save --json '{"fields":{"kind":"plan","title":"MVP"}}' --actor orchestrator`,
        "Создать план",
      ],
      ["relay-cli project save --file - --actor orchestrator", "Прочитать JSON из stdin"],
    ],
    configure: (command) =>
      command
        .option("--json <json>", "Документ JSON")
        .option("--file <path>", "Файл JSON; - означает stdin"),
    run: async (context, input) => {
      const text = await context.runtime.input.text(
        input.options.json,
        input.options.file,
        1024 * 1024,
      );
      invariant(text, "INPUT_SOURCE_REQUIRED", "Передайте --json или --file");
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw new AppError("INVALID_JSON", "Ожидается корректный JSON");
      }
      const command = parse(saveProjectRecordSchema, value, "документ проекта");
      const saved = await context.backend.lifecycle.save(command, author(context));
      return {
        data: { id: saved.id, revision: saved.revision },
        text: `Сохранено: ${saved.fields.title || saved.id} · ревизия ${saved.revision}`,
      };
    },
  });
}
