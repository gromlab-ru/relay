export interface Result {
  data: unknown;
  meta?: Record<string, unknown>;
  /** Человекочитаемое представление не входит в JSON-контракт. */
  text?: string;
}

export type OutputFormat = "json" | "text";

export function serializeResult(result: Result, format: OutputFormat): string {
  if (format === "json") {
    return `${JSON.stringify({ ok: true, data: result.data, ...(result.meta ? { meta: result.meta } : {}) })}\n`;
  }
  const body = result.text ?? JSON.stringify(result.data, null, 2);
  const footer = result.meta?.nextCursor
    ? `\n\nПродолжение: --cursor ${result.meta.nextCursor}`
    : result.meta?.truncated
      ? "\n\nПоказана часть данных."
      : "";
  const rendered = body + footer;
  return rendered.endsWith("\n") ? rendered : `${rendered}\n`;
}

export function resultBytes(result: Result, format: OutputFormat): number {
  return Buffer.byteLength(serializeResult(result, format));
}
