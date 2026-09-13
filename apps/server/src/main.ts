import { fileURLToPath } from "node:url";
import { startServer } from "@tasks/server-runtime";

const webPort = process.env.TASKS_WEB_PORT ?? "5173";
const server = await startServer({
  cwd: process.cwd(),
  config:
    process.env.TASKS_CONFIG ??
    fileURLToPath(new URL("../playground/tasks.config.json", import.meta.resolve("#manifest"))),
  actor: process.env.TASKS_ACTOR ?? "human",
  ...(process.env.TASKS_PORT === undefined
    ? {}
    : { port: /^\d+$/.test(process.env.TASKS_PORT) ? Number(process.env.TASKS_PORT) : NaN }),
  webRoot: fileURLToPath(new URL("../web/dist/", import.meta.resolve("#manifest"))),
  allowedOrigins: [`http://127.0.0.1:${webPort}`, `http://localhost:${webPort}`],
});
console.log(`Tasks Web: ${server.url}\nTasks API: ${server.url}\nSwagger: ${server.url}/api/docs`);
const stop = () => {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  void server.close().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
