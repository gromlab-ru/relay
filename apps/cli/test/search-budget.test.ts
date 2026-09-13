import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture, invokeRaw, successful } from "./helpers/cli.js";

test("поиск отчётов сохраняет курсор и байтовый бюджет в JSON и текстовом режиме", async (t) => {
  const app = await fixture(t);
  const taskId = await app.create("Ограниченный контекст");
  const ids: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    ids.push(
      successful(
        await app.run<{ id: string }>([
          "log",
          "add",
          taskId,
          "--text",
          `Решение ${index}\nneedle ${"контекст 🔬 ".repeat(20)}`,
        ]),
      ).data.id,
    );
  }
  for (const format of ["json", "text"] as const) {
    const seen: string[] = [];
    let cursor: string | null | undefined;
    for (let page = 0; page < 20; page += 1) {
      const args = [
        "log",
        "search",
        taskId,
        "--query",
        "needle",
        "--limit",
        "100",
        "--max-bytes",
        "1024",
        ...(cursor ? ["--cursor", cursor] : []),
      ];
      if (format === "json") {
        const call = await app.run<{ items: Array<{ id: string }> }>(args);
        assert.ok(Buffer.byteLength(call.stdout) <= 1024);
        const result = successful(call);
        seen.push(...result.data.items.map((item) => item.id));
        cursor = result.meta?.nextCursor;
      } else {
        const call = await invokeRaw(app.root, args);
        assert.equal(call.code, 0, call.stdout + call.stderr);
        assert.ok(Buffer.byteLength(call.stdout) <= 1024);
        seen.push(...(call.stdout.match(/^log_[a-f0-9]{32}/gm) ?? []));
        cursor = /Продолжение: --cursor (\S+)/.exec(call.stdout)?.[1] ?? null;
      }
      if (!cursor) break;
    }
    assert.equal(cursor, null);
    assert.deepEqual(seen, [...ids].reverse());
  }
});
