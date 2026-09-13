import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { distributionManifest, releaseMetadata } from "../scripts/release/metadata.mjs";
import { publishedIntegrity, shouldPublish } from "../scripts/release/registry.mjs";

function manifests(version = "0.2.0") {
  return {
    manifest: {
      name: "@gromlab/tasks-cli",
      version,
      bin: { "tasks-cli": "dist/cli/main.js" },
      publishConfig: { access: "public", registry: "https://registry.npmjs.org" },
      repository: { type: "git", url: "git+https://github.com/gromlab-ru/tasks-cli.git" },
      engines: { node: ">=22" },
    },
    lock: {
      name: "@gromlab/tasks-monorepo",
      version: "0.0.0",
      packages: {
        "": { name: "@gromlab/tasks-monorepo", version: "0.0.0" },
        "apps/cli": { name: "@gromlab/tasks-cli", version },
      },
    },
  };
}

test("релиз сверяет тег, оба манифеста и канал предварительной версии", () => {
  for (const [version, channel] of [
    ["0.2.0", "latest"],
    ["0.2.0-rc.1", "next"],
  ]) {
    const { manifest, lock } = manifests(version);
    const metadata = releaseMetadata(manifest, lock, `v${version}`);
    assert.equal(metadata.distTag, channel);
    assert.equal(metadata.archiveName, `gromlab-tasks-cli-${version}.tgz`);
  }
  const { manifest, lock } = manifests();
  assert.throws(() => releaseMetadata(manifest, lock, "v0.2.1"));
  assert.throws(() => releaseMetadata(manifest, { ...lock, version: "0.2.0" }, "v0.2.0"));
  assert.throws(() =>
    releaseMetadata(
      manifest,
      {
        ...lock,
        packages: {
          ...lock.packages,
          "apps/cli": { ...lock.packages["apps/cli"], version: "0.2.1" },
        },
      },
      "v0.2.0",
    ),
  );
  assert.throws(() => releaseMetadata(manifest, { ...lock, packages: { "": lock.packages[""] } }));
  assert.throws(() => releaseMetadata({ ...manifest, private: true }, lock));
  assert.throws(() => releaseMetadata({ ...manifest, name: lock.name }, lock));
  assert.throws(() => releaseMetadata({ ...manifest, bin: { "tasks-cli": "dist/main.js" } }, lock));
  assert.throws(() => releaseMetadata({ ...manifest, engines: { node: ">=18" } }, lock));
  assert.throws(() =>
    releaseMetadata({ ...manifest, repository: { type: "git", url: "https://example.com" } }, lock),
  );
  for (const version of ["01.1.0", "0.1", "0.1.0-01", "0.1.0+build.1", "0.1.0\n"]) {
    const candidate = manifests(version);
    assert.throws(() => releaseMetadata(candidate.manifest, candidate.lock, `v${version}`));
  }
});

test("release staging includes external runtime dependencies, not private workspaces or tools", () => {
  const manifest = {
    ...manifests().manifest,
    dependencies: { "@tasks/core": "*", "@tasks/server-runtime": "*", commander: "^14.0.0" },
    devDependencies: { esbuild: "^0.28.2", "@tasks/typescript-config": "*" },
    scripts: { prepack: "node scripts/release/assemble-package.mjs" },
    imports: { "#manifest": "./package.json" },
  };
  const workspaces = [
    { name: "@tasks/contracts", version: "0.0.0", private: true, dependencies: {} },
    {
      name: "@tasks/core",
      version: "0.0.0",
      private: true,
      dependencies: { zod: "^4.1.0", "proper-lockfile": "^4.1.2" },
    },
    {
      name: "@tasks/server-runtime",
      version: "0.0.0",
      private: true,
      dependencies: {
        "@tasks/core": "*",
        "@tasks/contracts": "*",
        "@nestjs/core": "^12.0.1",
        zod: "^4.1.0",
      },
    },
  ];
  const staged = distributionManifest(manifest, workspaces);
  assert.equal(staged.name, manifest.name);
  assert.equal(staged.version, manifest.version);
  assert.deepEqual(staged.bin, manifest.bin);
  assert.deepEqual(staged.repository, manifest.repository);
  assert.deepEqual(staged.imports, { "#manifest": "./package.json" });
  assert.deepEqual(staged.dependencies, {
    "@nestjs/core": "^12.0.1",
    commander: "^14.0.0",
    "proper-lockfile": "^4.1.2",
    zod: "^4.1.0",
  });
  assert.equal(staged.scripts, undefined);
  assert.equal(staged.devDependencies, undefined);
  assert(manifest.scripts.prepack, "The source manifest must not be mutated");
  assert.throws(() => distributionManifest(manifest, workspaces.slice(1)));
  for (const dependencies of [
    { "@tasks/missing": "*" },
    { "@tasks/core": "workspace:*" },
    { zod: "^3.0.0" },
    { external: "file:../external" },
  ]) {
    assert.throws(() => distributionManifest({ ...manifest, dependencies }, workspaces));
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
