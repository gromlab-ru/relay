import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { GraphService } from "../packages/core/src/application/graph/service.ts";
import { GraphTransaction } from "../packages/core/src/storage/graph-transaction.ts";
import { initialize, openWorkspace } from "../packages/core/src/storage/workspace.ts";
import { exists } from "../packages/core/src/storage/files.ts";
import type { GraphNode } from "../packages/core/src/domain/entity-graph.ts";

/** Нагрузочный каталог отделяет стоимость отношений от чтения прежних продуктовых записей. */
const nodes: GraphNode[] = Array.from({ length: 10000 }, (_, index) => ({
  ref: { kind: "benchmark", id: `node-${index}` },
  key: String(index),
  title: `Узел ${index}`,
  revision: 1,
  status: "",
}));
const catalog = async () => ({ nodes, edges: [] });
const address = (index: number) => nodes[index % nodes.length]!.ref;
const selected = { root: "benchmark:node-1234", depth: 1, limit: 20 };
const round = (value: number) => Math.round(value * 100) / 100;

/** Подсчитывает реальные байты JSON без учёта блоков и служебных структур файловой системы. */
async function sizeOf(path: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  for (const item of await readdir(path, { withFileTypes: true })) {
    const target = join(path, item.name);
    if (item.isDirectory()) {
      const nested = await sizeOf(target);
      bytes += nested.bytes;
      files += nested.files;
    } else {
      bytes += (await stat(target)).size;
      files++;
    }
  }
  return { bytes, files };
}

if (process.argv[2] === "--cold") {
  const workspace = await openWorkspace(process.argv[3]!);
  const graph = new GraphService(workspace, catalog);
  const start = performance.now();
  const page = await graph.read(selected);
  console.log(
    JSON.stringify({
      ms: round(performance.now() - start),
      nodes: page.totalNodes,
      edges: page.totalEdges,
      reads: graph.repository.metrics,
      heapMiB: round(process.memoryUsage().heapUsed / 1024 / 1024),
    }),
  );
} else {
  const isMeasure = process.argv[2] === "--measure";
  const resume = process.argv[2] === "--resume" || isMeasure ? process.argv[3] : undefined;
  const sizes = (resume ? process.argv.slice(4) : process.argv.slice(2)).map(Number);
  if (sizes.length === 0) sizes.push(10000, 100000);
  assert.ok(sizes.every((size) => Number.isInteger(size) && size > 0 && size % 100 === 0));
  assert.ok(!resume || sizes.length === 1, "Для существующей базы укажите один размер");
  const artifacts = new URL("../.artifacts/", import.meta.url).pathname;
  await mkdir(artifacts, { recursive: true });
  const results = [];
  for (const count of sizes) {
    const root = resume ?? (await mkdtemp(join(artifacts, `graph-scale-${count}-`)));
    const workspace = resume ? await openWorkspace(root) : await initialize(root, "tasks");
    const graph = new GraphService(workspace, catalog);
    const runId = randomUUID();
    let version = (await graph.read({ limit: 1 })).version;
    if (isMeasure) {
      const previous = await graph.read({ ...selected, type: "references", limit: 100 });
      assert.ok(previous.edges.every((edge) => edge.createdBy === "benchmark"));
      if (previous.edges.length > 0)
        version = (
          await graph.mutate(
            {
              ifVersion: version,
              requestId: `measure-clean-${runId}`,
              operations: previous.edges.map((edge) => ({
                action: "remove" as const,
                id: edge.id,
              })),
            },
            "benchmark",
          )
        ).version;
      assert.equal(
        (await graph.read({ limit: 1 })).totalEdges,
        count,
        "Размер исходного корпуса изменён",
      );
    }
    const seededBefore = isMeasure ? count : (await graph.repository.meta()).eventCount;
    assert.equal(seededBefore % 100, 0, "Продолжение допускается только во время наполнения");
    const seedStart = performance.now();
    for (let offset = seededBefore; offset < count; offset += 100) {
      const saved = await graph.mutate(
        {
          ifVersion: version,
          requestId: `seed-${offset}`,
          operations: Array.from({ length: 100 }, (_, index) => {
            const number = offset + index;
            return {
              action: "add" as const,
              type: `relation-${number % 7}`,
              from: address(number),
              to: address(number * 17 + 3),
              description: "Контекст связи для проверки масштабирования. ".repeat(6),
            };
          }),
        },
        "benchmark",
      );
      version = saved.version;
      if ((offset + 100) % 10000 === 0)
        console.log(
          JSON.stringify({
            progress: offset + 100,
            count,
            seconds: round((performance.now() - seedStart) / 1000),
            root,
          }),
        );
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
    const warm = [];
    const readsBefore = { ...graph.repository.metrics };
    for (let run = 0; run < 5; run++) {
      const start = performance.now();
      await graph.read(selected);
      warm.push(round(performance.now() - start));
    }
    assert.equal(graph.repository.metrics.eventReads - readsBefore.eventReads, 0);
    assert.ok(graph.repository.metrics.currentReads - readsBefore.currentReads <= 100);
    const writeStart = performance.now();
    const saved = await graph.mutate(
      {
        ifVersion: version,
        requestId: `measured-write-${runId}`,
        operations: [{ action: "add", type: "references", from: address(1234), to: address(1235) }],
      },
      "benchmark",
    );
    const writeMs = performance.now() - writeStart;
    const rebuildStart = performance.now();
    await graph.reindex();
    const rebuildMs = performance.now() - rebuildStart;
    const crashCommand = {
      ifVersion: saved.version,
      requestId: `recovery-write-${runId}`,
      operations: [
        { action: "add" as const, type: "references", from: address(1234), to: address(1236) },
      ],
    };
    const original = GraphTransaction.prototype.recover;
    GraphTransaction.prototype.recover = async function (assertOwned) {
      if (await exists(this.pending)) throw new Error("Контрольное прерывание");
      return original.call(this, assertOwned);
    };
    try {
      await assert.rejects(graph.mutate(crashCommand, "benchmark"), /Контрольное прерывание/);
    } finally {
      GraphTransaction.prototype.recover = original;
    }
    const recoveryStart = performance.now();
    const recovered = await graph.read(selected);
    const recoveryMs = performance.now() - recoveryStart;
    const repeat = await graph.mutate(crashCommand, "benchmark");
    assert.equal(repeat.version, recovered.version);
    const size = await sizeOf(graph.repository.root);
    const result = {
      mode: isMeasure ? "measure" : "seed",
      count,
      seededBefore,
      catalogNodes: nodes.length,
      root,
      seedMs: round(seedMs),
      cold,
      warmMs: warm,
      writeMs: round(writeMs),
      rebuildMs: round(rebuildMs),
      recoveryMs: round(recoveryMs),
      jsonMiB: round(size.bytes / 1024 / 1024),
      files: size.files,
      node: process.version,
      platform: process.platform,
    };
    results.push(result);
    await writeFile(
      join(artifacts, `graph-storage-benchmark-${count}.json`),
      JSON.stringify(result, null, 2) + "\n",
    );
    await writeFile(
      join(artifacts, "graph-storage-benchmark.json"),
      JSON.stringify(results, null, 2) + "\n",
    );
    console.log(JSON.stringify({ result }));
  }
}
