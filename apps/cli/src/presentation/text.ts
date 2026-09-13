import { toText } from "#core/domain/markdown";
import { safeText } from "./safe.js";
import { defaultTextOptions, palette } from "./theme.js";
import type { TextOptions } from "./theme.js";
import { renderMarkdown } from "./markdown.js";
import { section, wrap } from "./layout.js";
export { safeText } from "./safe.js";

export function markdownText(
  lines: readonly string[],
  options: TextOptions = defaultTextOptions,
): string {
  return renderMarkdown(toText(lines), options);
}

/** Короткий фрагмент не разрывает Unicode-символы и не меняет оригинал записи. */
export function previewText(value: string, limit = 160): string {
  const characters = Array.from(value);
  return characters.slice(0, limit).join("") + (characters.length > limit ? "…" : "");
}

export function valueText(value: unknown, options: TextOptions = defaultTextOptions): string {
  const colors = palette(options);
  if (value === null || value === undefined) return colors.dim("—");
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (Array.isArray(value))
    return value.map((item) => `• ${valueText(item, options)}`).join("\n") || colors.dim("—");
  if (typeof value === "object")
    return Object.entries(value)
      .map(
        ([name, item]) =>
          `${colors.dim(safeText(name) + ":")} ${valueText(item, options).replaceAll("\n", "\n  ")}`,
      )
      .join("\n");
  return safeText(String(value));
}

export function fieldsText(
  fields: Record<string, unknown>,
  options: TextOptions = defaultTextOptions,
): string {
  return Object.entries(fields)
    .map(([name, value]) =>
      section(
        safeText(name),
        ["description", "summary", "body"].includes(name) && Array.isArray(value)
          ? markdownText(value as string[], options)
          : wrap(valueText(value, options), options.width),
        options,
      ),
    )
    .join("\n\n");
}
