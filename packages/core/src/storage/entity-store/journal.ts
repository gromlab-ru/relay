import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { actorSchema, requestIdSchema } from "@relay/contracts/primitives";
import { entityAddress, entityRefSchema } from "@relay/contracts/entities/graph";
import type { JsonValue } from "@relay/contracts/storage";
import type { StorageSession } from "./store.js";
import { atomicJson, exists, readJson } from "../files.js";
import { checkSize, digest, RECORD_BYTES } from "./format.js";
import { invariant } from "../../shared/errors.js";

export const JOURNAL_ENTRIES = 128;
export const JOURNAL_BYTES = 1024 * 1024;
export const indexedEventSchema = z.strictObject({
  kind: z.literal("indexed"),
  index: z.string(),
  key: z.string(),
  value: z.json(),
  groups: z.array(
    z.strictObject({
      index: z.string(),
      key: z.string(),
      member: z.string().nullable().default(null),
    }),
  ),
});
export const journalEntrySchema = z.strictObject({
  at: z.iso.datetime(),
  actor: actorSchema,
  namespace: z.string(),
  requestId: requestIdSchema,
  requestHash: z.string(),
  result: z.json(),
  refs: z.array(entityRefSchema),
  events: z.array(z.json()),
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;
export const journalSegmentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  first: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  entries: z.array(journalEntrySchema).min(1).max(JOURNAL_ENTRIES),
});
type Segment = z.infer<typeof journalSegmentSchema>;
const cursorSchema = z.strictObject({ path: z.string(), next: z.number().int().positive() });
const writerSchema = z.strictObject({ root: z.string(), host: z.string(), stream: z.uuid() });
const pathSchema = z.string().regex(/^history\/[a-f0-9-]{36}\/[0-9]{16}\.json$/);
const groups = new Set(["record-audit-keys", "graph-events", "graph-operations", "task-activity"]);
export const receiptKey = (command: Pick<JournalEntry, "namespace" | "actor" | "requestId">) =>
  JSON.stringify([command.namespace, command.actor, command.requestId]);
const groupKey = (index: string, key: string) => JSON.stringify([index, key]);

/** Исторический поиск указывает на сегменты, а не на каждое отдельное событие. */
export function historyBucket(index: string, key: string): string | undefined {
  if (index === "record-audit") return groupKey(index, key.split(":").slice(0, 2).join(":"));
  if (index === "task-activity-event") return groupKey(index, key.split(":")[0]!);
  if (index === "graph-event")
    return groupKey(index, String(Math.floor(Number(key.split(":")[0]) / JOURNAL_ENTRIES)));
  return undefined;
}

/** История фиксирует изменение Markdown; комментарий остаётся полным продуктовым текстом. */
export function compactHistoryValue(index: string, value: JsonValue): JsonValue {
  if (
    index !== "task-activity-event" ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  )
    return value;
  if (!Array.isArray(value.changes)) return value;
  return {
    ...value,
    changes: value.changes.map((change) => {
      if (
        !change ||
        typeof change !== "object" ||
        Array.isArray(change) ||
        change.format !== "markdown"
      )
        return change;
      return { ...change, before: null, after: null, contentOmitted: true };
    }),
  };
}

/** Сегменты истории принадлежат той же сессии и публикуются тем же WAL, что сущности. */
export class Journal {
  private readonly cache = new Map<string, Segment>();
  private readonly values = new WeakMap<Segment, Map<string, JsonValue>>();
  private readonly members = new WeakMap<Segment, Map<string, Set<string>>>();
  private stream: string | undefined;
  private sequence = 1;
  constructor(private readonly session: StorageSession) {}

  async prepare(owned: () => void): Promise<string> {
    const root = this.session.store.root;
    const path = join(root, "runtime/history-writer.json");
    const old = (await exists(path)) ? writerSchema.parse(await readJson(path)) : undefined;
    const writer =
      old?.root === root && old.host === hostname()
        ? old
        : { root, host: hostname(), stream: randomUUID() };
    if (writer !== old) await atomicJson(path, writer, join(root, "runtime"), false, owned);
    this.stream = writer.stream;
    const value = await this.session.indexGet("journal-writers", writer.stream);
    this.sequence = value === undefined ? 1 : cursorSchema.parse(value).next;
    invariant(
      Number.isSafeInteger(this.sequence),
      "STORAGE_LIMIT_EXCEEDED",
      "Исчерпан поток истории",
      4,
    );
    return `${writer.stream}:${this.sequence}`;
  }

  async segment(path: string): Promise<Segment> {
    pathSchema.parse(path);
    const cached = this.cache.get(path);
    if (cached) return cached;
    const raw = await this.session.readFile(path);
    this.session.store.metrics.operationReads++;
    invariant(raw !== null, "STORAGE_INDEX_CORRUPT", "Сегмент истории отсутствует", 5, { path });
    const segment = journalSegmentSchema.parse(raw);
    invariant(
      Number(path.split("/").at(-1)!.slice(0, -5)) === segment.first,
      "INVALID_DATA",
      "Номер сегмента истории не совпадает с путём",
      5,
    );
    this.cache.set(path, segment);
    return segment;
  }

  /** Один раз разбирает ограниченный сегмент; это локальный кеш чтения, не дисковый индекс событий. */
  private prepareValues(segment: Segment) {
    if (this.values.has(segment)) return;
    const values = new Map<string, JsonValue>();
    const members = new Map<string, Set<string>>();
    for (const entry of segment.entries)
      for (const raw of entry.events) {
        const event = indexedEventSchema.parse(raw);
        const key = groupKey(event.index, event.key);
        const old = values.get(key);
        invariant(
          old === undefined || digest(old) === digest(event.value),
          "STORAGE_INDEX_CONFLICT",
          "Сегмент содержит разные значения одного события",
          4,
        );
        values.set(key, event.value);
        for (const group of event.groups) {
          const address = groupKey(group.index, group.key);
          const ids = members.get(address) ?? new Set<string>();
          ids.add(group.member ?? event.key);
          members.set(address, ids);
        }
      }
    this.values.set(segment, values);
    this.members.set(segment, members);
  }

  async operation(id: string) {
    const [stream, number, extra] = id.split(":");
    z.uuid().parse(stream);
    const sequence = Number(number);
    invariant(
      !extra && Number.isSafeInteger(sequence) && sequence > 0,
      "INVALID_DATA",
      "Неверный адрес записи истории",
      5,
    );
    const paths = await this.session.indexPostings("journal-streams", stream!);
    const path = paths
      .filter((entry) => Number(entry.split("/").at(-1)!.slice(0, -5)) <= sequence)
      .at(-1);
    invariant(path, "STORAGE_INDEX_CORRUPT", "Потерян адрес записи истории", 5);
    const segment = await this.segment(path);
    const entry = segment.entries[sequence - segment.first];
    invariant(entry, "STORAGE_INDEX_CORRUPT", "Позиция истории отсутствует в сегменте", 5);
    return { ...entry, id, schemaVersion: 2 as const };
  }

  async value(index: string, key: string): Promise<JsonValue | undefined> {
    const bucket = historyBucket(index, key);
    invariant(bucket, "INVALID_ARGUMENT", "Неизвестный исторический индекс");
    for (const path of await this.session.indexPostings("history-values", bucket)) {
      const segment = await this.segment(path);
      this.prepareValues(segment);
      const value = this.values.get(segment)!.get(groupKey(index, key));
      if (value !== undefined) return structuredClone(value);
    }
    return undefined;
  }

  async postings(index: string, key: string): Promise<string[] | undefined> {
    if (!groups.has(index)) return undefined;
    const result = new Set<string>();
    const collect = (raw: JsonValue) => {
      const event = indexedEventSchema.parse(raw);
      for (const group of event.groups)
        if (group.index === index && group.key === key) result.add(group.member ?? event.key);
    };
    for (const path of await this.session.indexPostings("history-groups", groupKey(index, key))) {
      const segment = await this.segment(path);
      this.prepareValues(segment);
      for (const id of this.members.get(segment)!.get(groupKey(index, key)) ?? []) result.add(id);
    }
    for (const event of this.session.events) collect(event);
    return [...result].sort();
  }

  async append(input: JournalEntry): Promise<void> {
    invariant(this.stream, "STORAGE_SESSION_REQUIRED", "Поток истории не подготовлен", 5);
    const entry = journalEntrySchema.parse({
      ...input,
      events: input.events.map((raw) => {
        const event = indexedEventSchema.parse(raw);
        return { ...event, value: compactHistoryValue(event.index, event.value) };
      }),
    });
    const cursor = await this.session.indexGet("journal-writers", this.stream);
    let path = cursor === undefined ? undefined : cursorSchema.parse(cursor).path;
    let segment = path ? await this.segment(path) : undefined;
    invariant(
      !path ||
        (path.split("/")[1] === this.stream &&
          segment!.first + segment!.entries.length === this.sequence),
      "STORAGE_INDEX_CORRUPT",
      "Указатель записи истории не соответствует последнему сегменту",
      5,
    );
    const next = segment ? { ...segment, entries: [...segment.entries, entry] } : undefined;
    if (
      !next ||
      next.entries.length > JOURNAL_ENTRIES ||
      Buffer.byteLength(JSON.stringify(next, null, 2) + "\n") > JOURNAL_BYTES
    ) {
      path = `history/${this.stream}/${String(this.sequence).padStart(16, "0")}.json`;
      segment = { schemaVersion: 1, first: this.sequence, entries: [entry] };
    } else segment = next;
    checkSize(segment, RECORD_BYTES, "Запись истории превышает 16 МиБ");
    await this.session.writeFile(path!, segment);
    this.cache.set(path!, segment);
    await this.indexEntry(path!, this.sequence, entry);
    this.sequence++;
  }

  /** Перестроение использует те же правила, что штатная публикация. */
  async indexEntry(path: string, sequence: number, entry: JournalEntry): Promise<void> {
    pathSchema.parse(path);
    const stream = path.split("/")[1]!;
    const id = `${stream}:${sequence}`;
    const cursor = await this.session.indexGet("journal-writers", stream);
    if (cursor === undefined || cursorSchema.parse(cursor).next <= sequence)
      this.session.indexSet("journal-writers", stream, { path, next: sequence + 1 });
    await this.session.addPosting("journal-streams", stream, path);
    const key = receiptKey(entry);
    const receipts = z
      .array(z.string())
      .parse((await this.session.indexGet("receipts", key)) ?? []);
    this.session.indexSet("receipts", key, [...new Set([...receipts, id])]);
    for (const ref of entry.refs)
      await this.session.addPosting("history-segments", entityAddress(ref), path);
    for (const [offset, raw] of entry.events.entries()) {
      const event = indexedEventSchema.parse(raw);
      const bucket = historyBucket(event.index, event.key);
      const old = bucket
        ? await this.value(event.index, event.key)
        : await this.session.value(event.index, event.key);
      invariant(
        old === undefined || digest(old) === digest(event.value),
        "STORAGE_INDEX_CONFLICT",
        "После слияния обнаружены разные значения исторической записи",
        4,
      );
      if (bucket) await this.session.addPosting("history-values", bucket, path);
      else this.session.indexSet(event.index, event.key, { operationId: id, offset });
      for (const group of event.groups) {
        if (groups.has(group.index))
          await this.session.addPosting("history-groups", groupKey(group.index, group.key), path);
        else await this.session.addPosting(group.index, group.key, group.member ?? event.key);
      }
      if (event.index === "reserved-key") await this.session.indexNumber(event.key);
    }
  }

  async history(address: string) {
    const result = [];
    for (const path of await this.session.indexPostings("history-segments", address)) {
      const segment = await this.segment(path);
      for (const [offset, entry] of segment.entries.entries())
        if (entry.refs.some((ref) => entityAddress(ref) === address))
          result.push({
            ...entry,
            id: `${path.split("/")[1]}:${segment.first + offset}`,
            schemaVersion: 2 as const,
          });
    }
    return result.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  }
}
