import { rm } from "node:fs/promises";

// Удалённые исходные модули не должны оставаться в следующем npm-архиве.
await rm(new URL("../dist/", import.meta.url), { recursive: true, force: true });
