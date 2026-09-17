import pc from "picocolors";
import { defaultConfig } from "@relay/core/domain/config";
import type { Config } from "@relay/core/domain/config";
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
  const label = rule?.satisfiesDependencies
    ? `✓ ${status === "done" ? "Выполнена" : safeText(status)}`
    : rule?.terminal
      ? `− ${status === "cancelled" ? "Отменена" : safeText(status)}`
      : status === "in_progress"
        ? "● В работе"
        : status === "review"
          ? "◇ На проверке"
          : `○ ${status === "todo" ? (blocked ? "Ожидает" : "К работе") : safeText(status)}`;
  const fallback = rule?.satisfiesDependencies
    ? "green"
    : rule?.terminal
      ? "gray"
      : status === "in_progress"
        ? "yellow"
        : status === "review"
          ? "magenta"
          : "cyan";
  const color = rule?.color ?? fallback;
  return color === "none" ? label : colors[color](label);
}

export function taskReference(task: { id: number }): string {
  return `#${task.id}`;
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
