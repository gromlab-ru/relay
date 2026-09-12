import pc from "picocolors";
import { defaultConfig } from "../domain/config.js";
import type { Config } from "../domain/config.js";
import { safeText } from "./safe.js";

export interface TextOptions {
  color: boolean;
  width: number;
}

export const defaultTextOptions: TextOptions = { color: false, width: 100 };

export function palette(options: TextOptions = defaultTextOptions) {
  return pc.createColors(options.color);
}

export function statusText(
  status: string,
  options: TextOptions,
  config: Config = defaultConfig,
  blocked = false,
): string {
  const colors = palette(options);
  const rule = config.statuses[status];
  if (rule?.satisfiesDependencies)
    return colors.green(`✓ ${status === "done" ? "Выполнена" : safeText(status)}`);
  if (rule?.terminal)
    return colors.dim(`− ${status === "cancelled" ? "Отменена" : safeText(status)}`);
  if (status === "in_progress") return colors.yellow("● В работе");
  if (status === "review") return colors.magenta("◇ На проверке");
  return colors.cyan(
    `○ ${status === "todo" ? (blocked ? "Ожидает" : "К работе") : safeText(status)}`,
  );
}

export function taskReference(task: { id: string; number?: number | undefined }): string {
  // Полный UUID остаётся копируемой ссылкой для ещё не пронумерованных документов.
  return task.number === undefined ? task.id : `#${task.number}`;
}

export function dateText(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
