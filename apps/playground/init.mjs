import { access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Пути привязаны к скрипту: запуск допустим из любой рабочей папки.
const root = new URL("./", import.meta.url);
const cli = fileURLToPath(new URL("../cli/scripts/dev.mjs", root));

for (const name of ["coffee-shop", "p2p-rental"]) {
  const directory = new URL(`${name}/`, root);
  await access(new URL("product-spec.md", directory));
  const config = fileURLToPath(new URL(".relay/config.json", directory));
  let initialized = true;
  try {
    await access(config);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    initialized = false;
  }
  const cwd = fileURLToPath(directory);
  const invoke = (args) =>
    execFileSync(
      process.execPath,
      ["--conditions=tasks-source", cli, "--config", config, "--local", ...args],
      { cwd, env: { ...process.env, INIT_CWD: cwd }, stdio: "inherit" },
    );
  if (!initialized) invoke(["init"]);
  invoke(["validate"]);
  console.log(
    `${name}: ${initialized ? "существующий проект сохранён" : "пустой проект инициализирован"}`,
  );
}

console.log(
  "Workspace: apps/playground/relay.workspace.json. Наполнение выполняется отдельно через Relay.",
);
