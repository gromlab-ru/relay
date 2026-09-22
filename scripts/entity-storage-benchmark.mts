import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, stat, statfs, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { z } from "zod";
import { EntityStore } from "../packages/core/src/storage/entity-store/store.ts";
import {
  createEntityStorageRegistry,
  markdownCodec,
} from "../packages/core/src/storage/entity-store/codecs.ts";
import { replaceOwnedRelations } from "../packages/core/src/storage/entity-store/relations.ts";
import {
  FullContextReader,
  FULL_CONTEXT_LIMITS,
} from "../packages/core/src/storage/entity-store/context.ts";
import type { ContextReadMetrics } from "../packages/core/src/storage/entity-store/context.ts";

/** Измеряет новый общий слой на настоящих JSON-записях, без каталога сущностей в памяти. */
const registry = () =>
  createEntityStorageRegistry([
    {
      kind: "benchmark",
      collection: "benchmarks",
      dataVersion: 1,
      schema: z.strictObject({ title: z.string(), description: z.string() }),
      ...markdownCodec([["description"]]),
      card: (record) => ({ title: String(record.data.title), status: "active", selectors: [] }),
    },
  ]);
const ref = (index: number) => ({
  kind: "benchmark",
  id: `n${index.toString(36).padStart(7, "0")}`,
});
const command = (requestId: string) => ({
  namespace: "benchmark",
  actor: "benchmark",
  requestId,
  request: requestId,
});
const round = (number: number) => Math.round(number * 100) / 100;

async function sizeOf(path: string): Promise<{ files: number; bytes: number }> {
  let files = 0,
    bytes = 0;
  for (const item of await readdir(path, { withFileTypes: true })) {
    const file = join(path, item.name);
    if (item.isDirectory()) {
      const nested = await sizeOf(file);
      files += nested.files;
      bytes += nested.bytes;
    } else {
      files++;
      bytes += (await stat(file)).size;
    }
  }
  return { files, bytes };
}

if (process.argv[2] === "--cold" || process.argv[2] === "--read") {
  const store = await EntityStore.open(process.argv[3]!, registry());
  const started = performance.now();
  await store.resolve("BENCH-1");
  const resolveMs = performance.now() - started;
  const resolveReads = { ...store.metrics };
  const start = performance.now();
  let phases: ContextReadMetrics | undefined;
  const reader = new FullContextReader(store, FULL_CONTEXT_LIMITS, (metrics) => {
    phases = metrics;
  });
  const context = await reader.read("BENCH-1");
  const result = {
    resolveMs: round(resolveMs),
    resolveReads,
    ms: round(performance.now() - start),
    nodes: context.nodes.length,
    edges: context.edges.length,
    bytes: Buffer.byteLength(JSON.stringify(context)),
    reads: { ...store.metrics },
    heapMiB: round(process.memoryUsage().heapUsed / 1024 / 1024),
    phases: phases
      ? Object.fromEntries(Object.entries(phases).map(([key, value]) => [key, round(value)]))
      : undefined,
  };
  if (process.argv[2] === "--read") {
    const before = { ...store.metrics };
    const started = performance.now();
    for (let index = 0; index < 100; index++) {
      const warm = await reader.read(`BENCH-${index + 1}`);
      assert.equal(warm.nodes.length, context.nodes.length);
      assert.equal(warm.edges.length, context.edges.length);
    }
    const measured = {
      ...result,
      warmRuns: 100,
      warmMeanMs: round((performance.now() - started) / 100),
      warmReads: Object.fromEntries(
        Object.entries(store.metrics).map(([key, value]) => [
          key,
          value - before[key as keyof typeof before],
        ]),
      ),
    };
    const artifacts = new URL("../.artifacts/", import.meta.url).pathname;
    await mkdir(artifacts, { recursive: true });
    await writeFile(
      join(artifacts, `entity-storage-read-${context.nodes.length}.json`),
      JSON.stringify(measured, null, 2) + "\n",
    );
    console.log(JSON.stringify(measured));
  } else console.log(JSON.stringify(result));
} else {
  const resume = process.argv[2] === "--resume" ? process.argv[3] : undefined;
  const sizes = process.argv.slice(resume ? 4 : 2).map(Number);
  if (!sizes.length) sizes.push(10_000, 100_000);
  assert.ok(
    sizes.every((count) => Number.isSafeInteger(count) && count >= 500 && count % 500 === 0),
    "Укажите размеры от 500, кратные 500; приёмочные корпуса — 10000 и 100000",
  );
  assert.ok(!resume || sizes.length === 1, "Для продолжения укажите один размер базы");
  const artifacts = new URL("../.artifacts/", import.meta.url).pathname;
  await mkdir(artifacts, { recursive: true });
  const storageDirectory = process.env.RELAY_STORAGE_BENCH_DIR ?? artifacts;
  await mkdir(storageDirectory, { recursive: true });
  for (const count of sizes) {
    const root = resume ?? (await mkdtemp(join(storageDirectory, `entity-scale-${count}-`)));
    const store = resume
      ? await EntityStore.open(root, registry())
      : await EntityStore.create(root, registry());
    if (resume)
      assert.equal(JSON.parse(await readFile(join(root, "benchmark.json"), "utf8")).count, count);
    else await writeFile(join(root, "benchmark.json"), JSON.stringify({ count }));
    const runId = randomUUID();
    console.log(JSON.stringify({ root, count, resumed: Boolean(resume) }));
    if (process.env.RELAY_STORAGE_BENCH_REINDEX === "1") await store.reindex();
    const at = new Date().toISOString();
    const seedStart = performance.now();
    for (let offset = 0; offset < count; offset += 500) {
      await store.run(command(`nodes-${offset}`), async (tx) => {
        for (let index = offset; index < offset + 500; index++)
          await tx.put(
            {
              schemaVersion: 1,
              dataVersion: 1,
              ...ref(index),
              revision: 1,
              key: `BENCH-${index + 1}`,
              aliases: [],
              createdAt: at,
              updatedAt: at,
              createdBy: "benchmark",
              updatedBy: "benchmark",
              data: {
                title: `Сущность ${index + 1}`,
                description: "## Описание\n\nСодержимое файловой записи.\n",
              },
            },
            null,
          );
        return { offset, count: 500 };
      });
      if ((offset + 500) % 10_000 === 0)
        console.log(JSON.stringify({ stage: "entities", done: offset + 500, count }));
    }
    // Десять связей одного владельца на файл; все узлы образуют одну компоненту с циклом.
    for (let offset = 0; offset < count; offset += 500) {
      await store.run(command(`relations-${offset}`), async (tx) => {
        for (let owner = offset; owner < offset + 500; owner += 10) {
          await replaceOwnedRelations(
            tx,
            ref(owner),
            "context",
            Array.from({ length: 10 }, (_, step) => ({
              type: "references",
              from: ref(owner + step),
              to: ref((owner + step + 1) % count),
              description: "Контекст",
            })),
            "benchmark",
          );
        }
        return { offset, count: 500 };
      });
      if ((offset + 500) % 10_000 === 0)
        console.log(JSON.stringify({ stage: "relations", done: offset + 500, count }));
    }
    const seedMs = performance.now() - seedStart;
    const cold = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--conditions=tasks-source",
          "--import",
          "tsx",
          new URL(import.meta.url).pathname,
          "--cold",
          root,
        ],
        { encoding: "utf8" },
      ),
    );
    assert.equal(cold.nodes, count);
    assert.equal(cold.edges, count);
    assert.equal(cold.reads.entityReads + cold.reads.relationReads + cold.reads.operationReads, 0);
    const reader = new FullContextReader(store);
    await reader.read("BENCH-1");
    const before = { ...store.metrics };
    const warmStart = performance.now();
    for (let index = 0; index < 100; index++) {
      const context = await reader.read(`BENCH-${index + 1}`);
      assert.equal(context.nodes.length, count);
      assert.equal(context.edges.length, count);
    }
    const warmMs = (performance.now() - warmStart) / 100;
    const reads = Object.fromEntries(
      Object.entries(store.metrics).map(([key, value]) => [
        key,
        value - before[key as keyof typeof before],
      ]),
    );
    assert.equal(reads.entityReads! + reads.relationReads! + reads.operationReads!, 0);
    let mutation = { files: 0, bytes: 0, persistentFiles: 0, persistentBytes: 0 };
    const measured = await EntityStore.open(root, registry(), async (stage) => {
      if (stage !== "intent") return;
      const pending = JSON.parse(await readFile(join(root, "transactions/pending.json"), "utf8"));
      for (const change of pending.changes) {
        const bytes = Buffer.byteLength(JSON.stringify(change.after, null, 2) + "\n");
        mutation.files++;
        mutation.bytes += bytes;
        if (!change.path.startsWith(".indexes/")) {
          mutation.persistentFiles++;
          mutation.persistentBytes += bytes;
        }
      }
    });
    const writeStart = performance.now();
    await measured.run(command(`measured-write-${runId}`), async (tx) => {
      const old = await tx.get(ref(0));
      await tx.put(
        { ...old, revision: old.revision + 1, data: { ...old.data, title: "Изменённое название" } },
        old.revision,
      );
      return { id: old.id };
    });
    const writeMs = performance.now() - writeStart;
    const rebuildStart = performance.now();
    await store.reindex();
    const reindexMs = performance.now() - rebuildStart;
    const crashed = await EntityStore.open(root, registry(), (stage) => {
      if (stage === "intent") throw new Error("Контрольное прерывание");
    });
    const input = command(`recovery-${runId}`);
    await assert.rejects(
      crashed.run(input, async (tx) => {
        const old = await tx.get(ref(0));
        await tx.put({ ...old, revision: old.revision + 1 }, old.revision);
        return { id: old.id };
      }),
      /Контрольное прерывание/,
    );
    const recoverStart = performance.now();
    const recovered = await EntityStore.open(root, registry());
    const recoveryMs = performance.now() - recoverStart;
    assert.deepEqual(
      await recovered.run(input, async () => {
        throw new Error("Повтор сценария");
      }),
      { id: ref(0).id },
    );
    const result = {
      count,
      root,
      node: process.version,
      platform: process.platform,
      filesystemType: `0x${(await statfs(root)).type.toString(16)}`,
      resumed: Boolean(resume),
      seedMs: round(seedMs),
      cold,
      warmRuns: 100,
      warmMeanMs: round(warmMs),
      warmReads: reads,
      mutation,
      writeMs: round(writeMs),
      reindexMs: round(reindexMs),
      recoveryMs: round(recoveryMs),
      entities: await sizeOf(join(root, "entities")),
      relations: await sizeOf(join(root, "relations")),
      operations: await sizeOf(join(root, "operations")),
      indexes: await sizeOf(join(root, ".indexes")),
      heapMiB: round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
    await writeFile(
      join(artifacts, `entity-storage-benchmark-${count}.json`),
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify({ result }));
  }
}
