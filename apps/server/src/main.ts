import { fileURLToPath } from "node:url";
import { startServer } from "./bootstrap.js";

const server = await startServer({
  cwd: process.cwd(),
  config:
    process.env.TASKS_CONFIG ??
    fileURLToPath(new URL("./playground/tasks.config.json", import.meta.resolve("#manifest"))),
  actor: process.env.TASKS_ACTOR ?? "human",
  port: process.env.TASKS_PORT === undefined ? 3000 : Number(process.env.TASKS_PORT),
  allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
});
console.log(`Tasks API: ${server.url}\nSwagger: ${server.url}/api/docs`);
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
