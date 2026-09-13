import { safeText } from "./safe.js";
import { palette } from "./theme.js";
import type { TextOptions } from "./theme.js";
import { wrap } from "./layout.js";

/** Небольшая лексическая подсветка распространённых блоков без загрузки языковых парсеров. */
function codeLine(line: string, language: string, options: TextOptions): string {
  const colors = palette(options);
  if (!["json", "js", "javascript", "ts", "typescript", "bash", "sh", "http"].includes(language))
    return colors.cyan(line);
  const tokens =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`|\/\/.*$|#[^\n]*$|\b(?:true|false|null|undefined|const|let|var|function|return|async|await|if|else|throw|new|import|from|export|GET|POST|PUT|PATCH|DELETE|HTTP)\b|\b\d+(?:\.\d+)?\b)/g;
  return line
    .split(tokens)
    .map((part, index) => {
      if (index % 2 === 0) return part;
      if (part.startsWith("//") || part.startsWith("#")) return colors.dim(part);
      if (/^["'`]/.test(part)) return colors.green(part);
      if (/^\d/.test(part)) return colors.yellow(part);
      return colors.magenta(part);
    })
    .join("");
}

function inline(text: string, options: TextOptions): string {
  const colors = palette(options);
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
    .map((part) => {
      if (part.startsWith("`")) return colors.cyan(part);
      if (part.startsWith("**")) return colors.bold(part);
      if (/^\[.*\]\(/.test(part)) return colors.blue(colors.underline(part));
      return part;
    })
    .join("");
}

/** Исходные абзацы и отступы сохраняются; окрашивается только безопасный отображаемый текст. */
export function renderMarkdown(text: string, options: TextOptions): string {
  const colors = palette(options);
  let fence: { marker: string; length: number; language: string } | undefined;
  return safeText(text)
    .split("\n")
    .map((line) => {
      const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (delimiter && !fence) {
        fence = {
          marker: delimiter[1]![0]!,
          length: delimiter[1]!.length,
          language: delimiter[2]!.trim().toLowerCase(),
        };
        return colors.dim(wrap(line, options.width));
      }
      if (fence) {
        if (
          delimiter &&
          delimiter[1]![0] === fence.marker &&
          delimiter[1]!.length >= fence.length &&
          !delimiter[2]!.trim()
        ) {
          fence = undefined;
          return colors.dim(wrap(line, options.width));
        }
        return wrap(codeLine(line, fence.language, options), options.width);
      }
      const heading = /^(#{1,6}\s+)(.*)$/.exec(line);
      if (heading)
        return wrap(colors.dim(heading[1]!) + colors.bold(colors.cyan(heading[2]!)), options.width);
      const bullet = /^(\s*(?:[-*+] |\d+[.)] ))(.*)$/.exec(line);
      if (bullet) return wrap(colors.cyan(bullet[1]!) + inline(bullet[2]!, options), options.width);
      if (/^\s*>/.test(line)) return wrap(colors.dim(line), options.width);
      return wrap(inline(line, options), options.width);
    })
    .join("\n");
}
