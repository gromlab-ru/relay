import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { API_PREFIX } from "#contracts";
import { actorSchema, parse } from "#core/domain/validation";
import { openWorkspace } from "#core/storage/workspace";
import { isErrno } from "#core/shared/errors";
import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./common/errors.js";
import { configureHttpPolicy } from "./common/http-policy.js";
import { setupOpenApi } from "./openapi/setup.js";

export interface ServerOptions {
  cwd: string;
  actor: string;
  config?: string;
  port?: number;
  /** По умолчанию dist/web внутри установленного пакета; false отключает статику. */
  webRoot?: string | false;
  allowedOrigins?: string[];
}

export async function createServer(options: ServerOptions): Promise<NestFastifyApplication> {
  const actor = parse(actorSchema, options.actor, "автор");
  const workspace = await openWorkspace(options.cwd, options.config);
  const candidate =
    options.webRoot === false
      ? undefined
      : options.webRoot
        ? resolve(options.webRoot)
        : fileURLToPath(new URL("./dist/web/", import.meta.resolve("#manifest")));
  let webRoot: string | undefined;
  if (candidate) {
    try {
      if ((await stat(join(candidate, "index.html"))).isFile()) webRoot = candidate;
    } catch (error) {
      if (!isErrno(error, "ENOENT")) throw error;
    }
  }
  const adapter = new FastifyAdapter({
    bodyLimit: 1024 * 1024,
    logger: false,
    forceCloseConnections: "idle",
  });
  configureHttpPolicy(adapter.getInstance(), options.allowedOrigins ?? []);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register({ cwd: options.cwd, configPath: workspace.configPath, actor }, webRoot),
    adapter,
    { logger: false, abortOnError: false },
  );
  try {
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalFilters(new ApiExceptionFilter());
    setupOpenApi(app);
    await app.init();
    await adapter.getInstance().ready();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}

export async function startServer(options: ServerOptions) {
  const port = parse(z.number().int().min(0).max(65535), options.port ?? 3000, "порт");
  const app = await createServer(options);
  try {
    await app.listen(port, "127.0.0.1");
    return { app, url: await app.getUrl(), close: () => app.close() };
  } catch (error) {
    await app.close();
    throw error;
  }
}
