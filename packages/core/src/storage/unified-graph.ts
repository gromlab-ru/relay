import { z } from "zod";
import { entityAddress, graphEventSchema, entityRefSchema } from "../domain/entity-graph.js";
import type { GraphEvent, GraphSaved } from "../domain/entity-graph.js";
import type { Workspace } from "./workspace.js";
import type { GraphCurrent } from "./graph-format.js";
import type { GraphSnapshot } from "./graph.js";
import type { ActivityFile } from "./task-activity.js";
import { TaskActivityRepository } from "./task-activity.js";
import { GraphIndex } from "./graph-index.js";
import {
  readOwned,
  publicRelation,
  writeOwnedRelations,
  appendGraphEvent,
} from "./entity-store/relations.js";
import { session, json } from "./unified-adapter.js";
import { invariant } from "../shared/errors.js";
import { fullContextVersion } from "./entity-store/context.js";

const snapshots = new WeakMap<GraphSnapshot, Map<string, GraphCurrent>>();
const ownerSchema = z.object({ owner: entityRefSchema, slot: z.string() });
const storedEventSchema = graphEventSchema.extend({
  edge: graphEventSchema.shape.edge.extend({ description: z.array(z.string()) }),
});

/** Совместимое представление прежнего API графа над наборами владельцев и общим журналом. */
export async function openUnifiedGraph(workspace: Workspace): Promise<GraphSnapshot> {
  const tx = session(workspace);
  const owners = new Map(
    (await tx.indexEntries("edges")).map(([, value]) => {
      const owner = ownerSchema.parse(value).owner;
      return [entityAddress(owner), owner];
    }),
  );
  const records = new Map<string, GraphCurrent>();
  for (const owner of owners.values())
    for (const entry of (await readOwned(tx, owner)).entries)
      records.set(entry.edge.id, {
        active: entry.edge.active,
        historyCount: entry.edge.historyCount ?? entry.edge.revision,
        edge: publicRelation(entry),
      });
  const base = await tx.value("graph-baseline", "legacy");
  const revision =
    (base ? z.object({ revision: z.number() }).parse(base).revision : 0) +
    (await tx.postings("graph-operations", "all")).length;
  const index = new GraphIndex({ schemaVersion: 1, revision: 0, shards: {} }, []);
  index.prepare([...records.values()], revision).publish();
  const snapshot: GraphSnapshot = {
    index,
    meta: {
      schemaVersion: 2,
      revision,
      eventCount: (await tx.postings("graph-events", "*")).length,
      indexFingerprint: index.fingerprint,
    },
  };
  snapshots.set(snapshot, records);
  return snapshot;
}

export function unifiedGraphRecord(snapshot: GraphSnapshot, id: string): GraphCurrent | undefined {
  return structuredClone(snapshots.get(snapshot)?.get(id));
}

export async function commitUnifiedGraph(
  workspace: Workspace,
  records: GraphCurrent[],
  events: GraphEvent[],
  key: string,
  hash: string,
  saved: (fingerprint: string, revision: number) => GraphSaved,
  owned: () => void,
  activity: ActivityFile[] = [],
): Promise<GraphSaved> {
  const tx = session(workspace);
  const groups = new Map<
    string,
    { owner: z.infer<typeof entityRefSchema>; updates: Parameters<typeof writeOwnedRelations>[2] }
  >();
  for (const record of records) {
    const indexed = await tx.indexGet("edges", record.edge.id);
    const binding = indexed
      ? ownerSchema.parse(indexed)
      : { owner: record.edge.from, slot: "diagnostic" };
    const address = entityAddress(binding.owner);
    const group = groups.get(address) ?? { owner: binding.owner, updates: [] };
    const event = events.findLast((event) => event.edge.id === record.edge.id);
    group.updates.push({
      slot: binding.slot,
      edge: {
        ...record.edge,
        description: record.edge.description.split("\n"),
        active: record.active,
        historyCount: record.historyCount,
        updatedAt: event?.at ?? record.edge.createdAt,
        updatedBy: event?.actor ?? record.edge.createdBy,
      },
    });
    groups.set(address, group);
  }
  for (const group of groups.values()) await writeOwnedRelations(tx, group.owner, group.updates);
  for (const event of events) await appendGraphEvent(tx, event);
  await new TaskActivityRepository(workspace).publish(activity, owned);
  const snapshot = await openUnifiedGraph(workspace);
  const result = saved(snapshot.index.fingerprint, snapshot.meta.revision);
  result.version = await fullContextVersion(tx);
  await tx.appendValue("graph-receipt", key, json({ hash, result }));
  return result;
}

export async function unifiedGraphHistory(
  workspace: Workspace,
  query: { id?: string | undefined; revision?: number | undefined; offset: number; limit: number },
) {
  const tx = session(workspace);
  const state = await openUnifiedGraph(workspace);
  invariant(
    query.revision === undefined || query.revision === state.meta.revision,
    "GRAPH_CHANGED",
    "Журнал изменился. Начните чтение заново",
    4,
  );
  const events: GraphEvent[] = [];
  const keys = await tx.postings("graph-events", query.id ?? "*");
  for (const key of keys.slice(query.offset, query.offset + query.limit)) {
    const value = await tx.value("graph-event", key);
    const stored = storedEventSchema.parse(value);
    events.push({
      ...stored,
      edge: { ...stored.edge, description: stored.edge.description.join("\n") },
    });
  }
  const next = query.offset + query.limit;
  return {
    items: events,
    total: keys.length,
    nextOffset: next < keys.length ? next : null,
    revision: state.meta.revision,
  };
}
