import stringWidth from "string-width";
import wrapAnsi from "wrap-ansi";
import { palette } from "./theme.js";
import type { TextOptions } from "./theme.js";

export function wrap(text: string, width: number): string {
  return wrapAnsi(text, Math.max(1, width), { hard: true, trim: false, wordWrap: true });
}

export function pad(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - stringWidth(text)));
}

/** Ширина считается в ячейках терминала: ANSI, emoji и широкие символы не сдвигают колонки. */
export function table(
  headers: string[],
  rows: string[][],
  widths: number[],
  options: TextOptions,
): string {
  const colors = palette(options);
  const render = (cells: string[]) => {
    const lines = cells.map((cell, index) => wrap(cell, widths[index]!).split("\n"));
    return Array.from({ length: Math.max(...lines.map((column) => column.length)) }, (_, row) =>
      lines
        .map((column, index) => pad(column[row] ?? "", widths[index]!))
        .join("  ")
        .trimEnd(),
    ).join("\n");
  };
  return [
    render(headers.map((header) => colors.bold(header))),
    colors.dim(widths.map((width) => "─".repeat(width)).join("  ")),
    ...rows.map(render),
  ].join("\n");
}

export function frame(title: string, lines: string[], options: TextOptions): string {
  const colors = palette(options);
  const width = options.width - 4;
  const content = [colors.bold(title), ...lines].flatMap((line) => wrap(line, width).split("\n"));
  return [
    colors.dim(`╭${"─".repeat(options.width - 2)}╮`),
    ...content.map((line) => `${colors.dim("│")} ${pad(line, width)} ${colors.dim("│")}`),
    colors.dim(`╰${"─".repeat(options.width - 2)}╯`),
  ].join("\n");
}

export function section(title: string, body: string, options: TextOptions): string {
  const colors = palette(options);
  return `${colors.bold(colors.cyan(title.toUpperCase()))}\n${body || colors.dim("—")}`;
}
