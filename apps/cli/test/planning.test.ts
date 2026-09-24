import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlanningSaved, PlanSummary } from "@relay/contracts/planning";
import { planningCandidatesPageSchema } from "@relay/contracts/planning";
import { releaseCompositionSchema } from "@relay/contracts/releases";
import { fixture, invoke, invokeRaw, successful } from "./helpers/cli.js";

test("CLI планирования: предметные аргументы, Markdown, ревизии, этапы и human/JSON", async (t) => {
  const { root } = await fixture(t);
  const created = successful(
    await invoke<PlanningSaved>(root, [
      "--actor",
      "human",
      "plan",
      "create",
      "--title",
      "План CLI",
      "--goal",
      "## Цель\n\nПроверить команду",
      "--request-id",
      "plan",
    ]),
  ).data;
  const stage = successful(
    await invoke<PlanningSaved>(root, [
      "--actor",
      "human",
      "plan",
      "stage",
      "create",
      created.id,
      "--title",
      "Этап",
      "--if-revision",
      created.revision,
      "--request-id",
      "stage",
    ]),
  ).data;
  assert(stage.stageId);
  const updated = successful(
    await invoke<PlanningSaved>(root, [
      "--actor",
      "human",
      "plan",
      "update",
      created.id,
      "--summary",
      "Краткое описание",
      "--if-revision",
      stage.revision,
      "--request-id",
      "update",
    ]),
  ).data;
  assert.equal(updated.revision, stage.revision + 1);
  const plan = successful(await invoke<PlanSummary>(root, ["plan", "get", created.id])).data;
  assert.equal(plan.goal, "## Цель\n\nПроверить команду");
  const text = await invokeRaw(root, ["plan", "get", created.id, "--color", "never"]);
  assert.equal(text.code, 0, text.stderr);
  assert.match(text.stdout, /План CLI/);
  assert.match(text.stdout, /Проверить команду/);
  assert(!text.stdout.includes('"goal"'));
  const other = successful(
    await invoke<PlanningSaved>(root, [
      "--actor",
      "human",
      "plan",
      "create",
      "--title",
      "План второй",
      "--request-id",
      "second",
    ]),
  ).data;
  const page = await invokeRaw(root, [
    "plan",
    "list",
    "--limit",
    1,
    "--q",
    "П",
    "--color",
    "never",
  ]);
  assert.equal(page.code, 0, page.stderr);
  assert.match(page.stdout, /Продолжение:/);
  assert.match(page.stdout, /--snapshot-version/);
  assert.match(page.stdout, /--q 'П'/);
  const previewArgs = ["release", "preview", "--plans", created.id, other.id, "--limit", 1];
  const preview = releaseCompositionSchema.parse(successful(await invoke(root, previewArgs)).data);
  assert.equal(preview.total, 2);
  assert.equal(preview.readiness.canRelease, false);
  const previewText = await invokeRaw(root, previewArgs);
  assert.equal(previewText.code, 0, previewText.stderr);
  assert(previewText.stdout.includes(`--plans '${created.id}' '${other.id}'`));
  const next = releaseCompositionSchema.parse(
    successful(
      await invoke(root, [...previewArgs, "--offset", 1, "--snapshot-version", preview.version]),
    ).data,
  );
  assert.equal(next.items[0]?.id, other.id);
  const task = successful(
    await invoke<{ id: string }>(root, [
      "task",
      "create",
      "--board",
      "product",
      "--title",
      "Выбор CLI",
      "--request-id",
      "candidate",
    ]),
  ).data;
  const candidates = planningCandidatesPageSchema.parse(
    successful(await invoke(root, ["plan", "candidates", "--q", "Выбор", "--board", "product"]))
      .data,
  );
  assert.equal(candidates.items[0]?.id, task.id);
  const release = successful(
    await invoke<PlanningSaved>(root, [
      "--actor",
      "human",
      "release",
      "create",
      "--title",
      "Будущий",
      "--release-version",
      "0.1",
      "--plans",
      created.id,
      "--request-id",
      "release",
    ]),
  ).data;
  assert(release.id);
});
