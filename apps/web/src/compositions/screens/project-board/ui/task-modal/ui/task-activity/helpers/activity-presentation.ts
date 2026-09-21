import {
  ArrowRightLeft,
  CheckCheck,
  Circle,
  FileText,
  Link2,
  ListChecks,
  MessageSquare,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActivityChange, ActivitySummary } from "domains/board-tasks";

/** Записи одного календарного дня в часовом поясе пользователя. */
type ActivityDay = {
  /** Стабильный ключ группы. */
  key: string;
  /** Читаемая дата. */
  label: string;
  /** Записи в исходном порядке. */
  entries: ActivitySummary[];
};

/** Текстовые подписи записи для визуального представления. */
type ActivityEntryPresentation = {
  /** Роль без повторения имени. */
  role: string;
  /** Время с точностью до секунды. */
  time: string;
  /** Полная дата для доступного имени и подсказки. */
  timestamp: string;
  /** Название действия. */
  title: string;
};

/**
 * Группирует последовательные страницы, не меняя порядок или границы их записей.
 */
export const groupActivityDays = (entries: ActivitySummary[]): ActivityDay[] => {
  const groups: ActivityDay[] = [];
  let previousDay = "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  for (const entry of entries) {
    const date = new Date(entry.at);
    const key = date.toDateString();
    const existing = groups.at(-1);
    if (existing && previousDay === key) {
      existing.entries.push(entry);
      continue;
    }
    const formatted = date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
    });
    const label =
      key === today.toDateString()
        ? `Сегодня, ${formatted}`
        : key === yesterday.toDateString()
          ? `Вчера, ${formatted}`
          : formatted;
    groups.push({ key: `${key}:${entry.id}`, label, entries: [entry] });
    previousDay = key;
  }
  return groups;
};

/**
 * Подготавливает компактную подпись автора и точное время без технических идентификаторов.
 */
export const describeActivityEntry = (entry: ActivitySummary): ActivityEntryPresentation => {
  const date = new Date(entry.at);
  const role =
    entry.actorRole === "orchestrator"
      ? "Оркестратор"
      : entry.actorRole === "worker"
        ? "Воркер"
        : entry.actorRole === "operator"
          ? "Оператор"
          : "";
  return {
    role: role === entry.actor ? "" : role,
    time: date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    timestamp: date.toLocaleString("ru-RU", { dateStyle: "full", timeStyle: "medium" }),
    title: entry.action === "comment-publish" ? `Сообщение «${entry.title}»` : entry.title,
  };
};

/**
 * Выбирает нейтральный маркер по смыслу события, а не по автору.
 */
export const getActivityIcon = (action: string): LucideIcon => {
  if (action === "comment-publish") return MessageSquare;
  if (action === "create") return Plus;
  if (action === "move") return ArrowRightLeft;
  if (action === "criterion-complete") return CheckCheck;
  if (action.startsWith("criterion-")) return ListChecks;
  if (action === "link" || action.startsWith("graph-")) return Link2;
  if (action === "update" || action === "snapshot") return FileText;
  return Circle;
};

/**
 * Сохраняет все подробности, заменяя адрес критерия в подписи его названием при наличии.
 */
export const presentActivityChanges = (changes: ActivityChange[]): ActivityChange[] =>
  changes.map((change) => {
    const match = /^acceptanceCriteria\.([^.]+)\./.exec(change.field);
    if (!match) return change;
    const titleChange = changes.find(
      (entry) => entry.field === `acceptanceCriteria.${match[1]}.title`,
    );
    const title = titleChange?.after ?? titleChange?.before;
    const prefix = title ? `Критерий «${title}»` : "Критерий приёмки";
    return { ...change, label: change.label.replace(/^Критерий\s+[^:]+:/, () => `${prefix}:`) };
  });
