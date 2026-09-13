#!/usr/bin/env node
import { runtime } from "./context.js";
import { runCli } from "./run.js";
import { isErrno } from "#core/shared/errors";

// Закрытый потребителем pipe — штатное завершение, а не ошибка трекера.
process.stdout.on("error", (error: Error) => {
  if (isErrno(error, "EPIPE")) process.exit(0);
  throw error;
});

process.exitCode = await runCli(process.argv.slice(2), runtime(process.stdin, process.stdout));
