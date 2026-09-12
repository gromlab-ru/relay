import { toText } from "../domain/markdown.js";

/** Сохраняем абзацы и отступы, но непечатные управляющие символы делаем видимыми. */
export function safeText(value: string): string {
  return value.replace(
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

export function markdownText(lines: readonly string[]): string {
  return safeText(toText(lines));
}

export function section(title: string, body: string): string {
  return `## ${title}\n\n${body || "—"}`;
}

/** Короткий фрагмент не разрывает Unicode-символы и не меняет оригинал записи. */
export function previewText(value: string, limit = 160): string {
  const characters = Array.from(value);
  return characters.slice(0, limit).join("") + (characters.length > limit ? "…" : "");
}

export function fieldsText(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .map(([name, value]) => {
      const body =
        Array.isArray(value) && value.every((line) => typeof line === "string")
          ? markdownText(value)
          : typeof value === "string"
            ? safeText(value)
            : JSON.stringify(value, null, 2);
      return section(name, body ?? "—");
    })
    .join("\n\n");
}
