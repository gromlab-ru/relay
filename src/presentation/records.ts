import type { Comment } from "../domain/comment.js";
import type { Log } from "../domain/log.js";
import { markdownText, safeText, section } from "./text.js";

export function commentText(comment: Comment): string {
  return `${comment.id}\n${comment.actor} · ${comment.createdAt}\n\n${markdownText(comment.body)}`;
}

export function logText(log: Log): string {
  const heading = `${log.id} · ${log.kind}${log.title ? ` · ${log.title}` : ""}`;
  return `${heading}\n${log.actor} · ${log.createdAt}\n\n${markdownText(log.body)}`;
}

export function commentsText(
  items: readonly { id: string; actor: string; createdAt: string; preview: string }[],
): string {
  return (
    items
      .map((item) => `${item.id}\n${item.actor} · ${item.createdAt}\n\n${safeText(item.preview)}`)
      .join("\n\n---\n\n") || "Комментариев нет."
  );
}

export function logsText(
  items: readonly Pick<Log, "id" | "actor" | "createdAt" | "kind" | "title" | "summary">[],
): string {
  return (
    items
      .map(
        (item) =>
          `${item.id} · ${item.kind}${item.title ? ` · ${item.title}` : ""}\n${item.actor} · ${item.createdAt}\n\n${markdownText(item.summary) || "Саммари не задано; полный отчёт: log get."}`,
      )
      .join("\n\n---\n\n") || "Отчётов нет."
  );
}

export function contextText(task: {
  comments: Record<string, Comment>;
  logs: Record<string, Log>;
}): string {
  const chronological = (
    a: { createdAt: string; id: string },
    b: { createdAt: string; id: string },
  ) =>
    a.createdAt === b.createdAt
      ? a.id.localeCompare(b.id, "en")
      : a.createdAt < b.createdAt
        ? -1
        : 1;
  return [
    section(
      "Комментарии",
      Object.values(task.comments).sort(chronological).map(commentText).join("\n\n---\n\n"),
    ),
    section(
      "Отчёты",
      Object.values(task.logs).sort(chronological).map(logText).join("\n\n---\n\n"),
    ),
  ].join("\n\n");
}
