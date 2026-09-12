import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { releaseMetadata } from "../scripts/release/metadata.mjs";
import { publishedIntegrity, shouldPublish } from "../scripts/release/registry.mjs";

function manifests(version = "0.1.0") {
  return {
    manifest: {
      name: "@gromlab/tasks-cli",
      version,
      bin: { "tasks-cli": "dist/cli/main.js" },
      publishConfig: { access: "public" },
      repository: { type: "git", url: "git+https://github.com/gromlab-ru/tasks-cli.git" },
    },
    lock: {
      name: "@gromlab/tasks-cli",
      version,
      packages: { "": { name: "@gromlab/tasks-cli", version } },
    },
  };
}

test("релиз сверяет тег, оба манифеста и канал предварительной версии", () => {
  for (const [version, channel] of [
    ["0.1.0", "latest"],
    ["0.2.0-rc.1", "next"],
  ]) {
    const { manifest, lock } = manifests(version);
    const metadata = releaseMetadata(manifest, lock, `v${version}`);
    assert.equal(metadata.distTag, channel);
    assert.equal(metadata.archiveName, `gromlab-tasks-cli-${version}.tgz`);
  }
  const { manifest, lock } = manifests();
  assert.throws(() => releaseMetadata(manifest, lock, "v0.1.1"));
  assert.throws(() => releaseMetadata(manifest, { ...lock, version: "0.1.1" }, "v0.1.0"));
  assert.throws(() =>
    releaseMetadata(
      manifest,
      { ...lock, packages: { "": { ...lock.packages[""], version: "0.1.1" } } },
      "v0.1.0",
    ),
  );
  for (const version of ["01.1.0", "0.1", "0.1.0-01", "0.1.0+build.1", "0.1.0\n"]) {
    const candidate = manifests(version);
    assert.throws(() => releaseMetadata(candidate.manifest, candidate.lock, `v${version}`));
  }
});

test("повторный релиз пропускается только при полном совпадении integrity архива", () => {
  const archive = Buffer.from("Проверенный архив 🔬");
  const integrity = `sha512-${createHash("sha512").update(archive).digest("base64")}`;
  assert.equal(shouldPublish(archive, null), true);
  assert.equal(shouldPublish(archive, integrity), false);
  assert.throws(() => shouldPublish(Buffer.from("Другой архив"), integrity));
});

test("проверка npm отличает отсутствие версии от ошибок доступа и сервера", async () => {
  const name = "@gromlab/tasks-cli";
  const version = "0.1.0";
  assert.equal(
    await publishedIntegrity(name, version, async () => new Response(null, { status: 404 })),
    null,
  );
  const record = { name, version, dist: { integrity: "sha512-test" } };
  assert.equal(
    await publishedIntegrity(name, version, async () => Response.json(record)),
    "sha512-test",
  );
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(() =>
      publishedIntegrity(name, version, async () => new Response(null, { status })),
    );
  }
  await assert.rejects(() =>
    publishedIntegrity(name, version, async () => Response.json({ ...record, version: "9.0.0" })),
  );
  await assert.rejects(() =>
    publishedIntegrity(name, version, async () => {
      throw new Error("Нет сети");
    }),
  );
});
