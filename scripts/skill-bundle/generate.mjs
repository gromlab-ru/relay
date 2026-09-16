import { Readable, Writable } from "node:stream";
import { createProgram } from "../../apps/cli/src/program.ts";
import { runtime } from "../../apps/cli/src/context.ts";
import { projectFieldsSchema } from "../../packages/core/src/domain/project.ts";
import { z } from "zod";

/** Экранирует содержимое ячейки, не меняя смысл справочного значения. */
function cell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

/** Дополняет описание ограничениями, которые использует сам Commander. */
function optionDescription(option) {
  let description = option.description;
  if (option.argChoices) description += ` Значения: ${option.argChoices.join(", ")}.`;
  if (option.defaultValue !== undefined)
    description += ` По умолчанию: ${JSON.stringify(option.defaultValue)}.`;
  return cell(description);
}

/** Строит справочник из тех же определений, которые предоставляют --help. */
function commandReference() {
  const sink = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const context = runtime(Readable.from([]), sink);
  const program = createProgram(context);
  const lines = [
    "# Команды Relay CLI",
    "",
    "Справочник сформирован из зарегистрированных команд. Порядок работы и примеры — в [главном руководстве](../skill.md) и [сценариях](EXAMPLES.md).",
    "",
    "`relay-cli` означает установленную команду или `npx @gromlab/relay-cli`. В workspace указывайте проект префиксом либо `--project`. Конкретный help: `relay-cli <команда> --help`.",
    "",
    "## Общие параметры",
    "",
    "| Параметр | Назначение |",
    "| --- | --- |",
    ...program.options.map(
      (option) => `| \`${cell(option.flags)}\` | ${optionDescription(option)} |`,
    ),
    "",
  ];
  const visit = (command, parents) => {
    const path = [...parents, command.name()];
    if (command.commands.length > 0) {
      for (const child of command.commands) visit(child, path);
      return;
    }
    lines.push(
      `## ${path.join(" ")}`,
      "",
      `**Синтаксис:** \`relay-cli ${path.join(" ")} ${command.usage()}\`.`,
      "",
      command.description(),
      "",
    );
    const argumentsList = command.createHelp().visibleArguments(command);
    if (argumentsList.length > 0) {
      lines.push("| Аргумент | Назначение |", "| --- | --- |");
      for (const argument of argumentsList)
        lines.push(`| \`${cell(argument.name())}\` | ${cell(argument.description)} |`);
      lines.push("");
    }
    if (command.options.length > 0) {
      lines.push("| Параметр | Назначение |", "| --- | --- |");
      for (const option of command.options)
        lines.push(`| \`${cell(option.flags)}\` | ${optionDescription(option)} |`);
      lines.push("");
    }
  };
  for (const command of program.commands) visit(command, []);
  sink.destroy();
  return lines.join("\n");
}

/** Описывает JSON-форму поля, включая варианты enum и ссылки. */
function fieldType(schema) {
  if (schema.const !== undefined) return `\`${cell(JSON.stringify(schema.const))}\``;
  if (schema.enum)
    return schema.enum.map((value) => `\`${cell(JSON.stringify(value))}\``).join(", ");
  if (schema.anyOf || schema.oneOf)
    return (schema.anyOf ?? schema.oneOf).map(fieldType).join(" или ");
  if (Array.isArray(schema.type))
    return schema.type.map((type) => fieldType({ ...schema, type })).join(" или ");
  if (schema.type === "array") return `массив: ${fieldType(schema.items ?? {})}`;
  const type =
    {
      string: "строка",
      integer: "целое",
      number: "число",
      boolean: "boolean",
      null: "null",
      object: "объект",
    }[schema.type] ?? "значение";
  return `${type}${schema.format ? ` (${schema.format})` : ""}${schema.pattern ? `; шаблон \`${cell(schema.pattern)}\`` : ""}`;
}

/** Справочник полей строится из входных схем Core, без ручного дублирования defaults. */
function recordReference() {
  const lines = [
    "# Поля проектных документов",
    "",
    "Таблицы сформированы из входных схем Core. Назначение документов и правила переходов — в [модели данных](DATA-MODEL.md).",
    "",
    "Создание: `project_record_save({ actor, fields: { kind, ... }, requestId })`. Обновление: прочитайте документ, скопируйте все `fields`, измените нужные значения и передайте `id` с его `ifRevision`.",
    "",
    "Необязательное поле при полном сохранении получает default; его пропуск не сохраняет старое значение. `id`, `revision`, авторство, `events` и `snapshot` принадлежат оболочке документа и не входят в `fields`.",
    "",
    "Текстовые абзацы — до 64 КиБ UTF-8; короткие строки — до 1024 байт. JSON Schema описывает форму, а междокументные связи и условия приёмки проверяет Core.",
    "",
  ];
  for (const schema of projectFieldsSchema.options) {
    const json = z.toJSONSchema(schema, { io: "input", target: "draft-7" });
    const kind = json.properties.kind.const;
    lines.push(
      `## ${kind}`,
      "",
      "| Поле | Формат | Обязательно при создании | По умолчанию |",
      "| --- | --- | --- | --- |",
    );
    for (const [name, field] of Object.entries(json.properties)) {
      const required = json.required?.includes(name) ? "да" : "нет";
      const fallback = Object.hasOwn(field, "default")
        ? `\`${cell(JSON.stringify(field.default))}\``
        : "—";
      lines.push(`| \`${name}\` | ${fieldType(field)} | ${required} | ${fallback} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Генераторы ограничены известными справочниками продукта. */
export function generateReference(name) {
  if (name === "cli") return commandReference();
  if (name === "records") return recordReference();
  throw new Error(`Неизвестный генератор справочника: ${name}`);
}
