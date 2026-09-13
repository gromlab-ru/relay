import type { Task } from "./task.js";
import { invariant } from "../shared/errors.js";

/** Рациональный ключ не теряет точность при повторных вставках между карточками. */
function fraction(rank: string): [bigint, bigint] {
  const [numerator, denominator] = rank.split("/");
  return [BigInt(numerator!), BigInt(denominator!)];
}

export function taskRank(task: Pick<Task, "id" | "rank">): string {
  return task.rank ?? `${task.id}/1`;
}

export function compareRanks(a: string, b: string): number {
  const [an, ad] = fraction(a);
  const [bn, bd] = fraction(b);
  const delta = an * bd - bn * ad;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}

export function compareTasks(a: Task, b: Task): number {
  return compareRanks(taskRank(a), taskRank(b)) || a.id - b.id;
}

export function rankBetween(left?: string, right?: string): string {
  if (!left && !right) return "1/1";
  if (!left) {
    const [n, d] = fraction(right!);
    return `${n - d}/${d}`;
  }
  if (!right) {
    const [n, d] = fraction(left);
    return `${n + d}/${d}`;
  }
  invariant(
    compareRanks(left, right) < 0,
    "RANK_CONFLICT",
    "Порядок соседних карточек изменился. Обновите доску или переместите карточку в конец колонки.",
    4,
  );
  const [an, ad] = fraction(left);
  const [bn, bd] = fraction(right);
  let n = an + bn;
  let d = ad + bd;
  let x = n < 0n ? -n : n;
  let y = d;
  while (y !== 0n) [x, y] = [y, x % y];
  n /= x;
  d /= x;
  return `${n}/${d}`;
}

export function appendRank(status: string, tasks: Iterable<Task>): string {
  const column = [...tasks].filter((task) => task.status === status).sort(compareTasks);
  const last = column.at(-1);
  return rankBetween(last ? taskRank(last) : undefined);
}
