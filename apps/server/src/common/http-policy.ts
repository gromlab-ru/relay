import {
  ForbiddenException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import type { FastifyInstance } from "fastify";
import { extname } from "node:path";

export function configureHttpPolicy(
  server: FastifyInstance,
  allowedOrigins: readonly string[],
): void {
  server.addHook("onRequest", async (request, reply) => {
    const host = request.headers.host ?? "";
    let hostname: string;
    try {
      hostname = new URL(`http://${host}`).hostname;
    } catch {
      throw new ForbiddenException("Недопустимый Host");
    }
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostname))
      throw new ForbiddenException("Разрешён только локальный доступ");
    const origin = request.headers.origin;
    if (origin && origin !== `http://${host}` && !allowedOrigins.includes(origin))
      throw new ForbiddenException("Источник запроса не разрешён");
    if (!origin && request.headers["sec-fetch-site"] === "cross-site")
      throw new ForbiddenException("Источник запроса не разрешён");

    const path = new URL(request.url, "http://localhost").pathname;
    const api = path === "/api" || path.startsWith("/api/");
    if (api) {
      void reply.header("Cache-Control", "no-store");
      if (
        ["POST", "PATCH", "PUT"].includes(request.method) &&
        request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !== "application/json"
      )
        throw new UnsupportedMediaTypeException("Ожидается Content-Type: application/json");
    }

    // У Fastify ServeStaticModule общий renderPath; исключаем API и отсутствующие ресурсы явно.
    if (
      request.routeOptions.url === "/*" &&
      (api ||
        path.startsWith("/assets/") ||
        extname(path) ||
        path.split("/").some((part) => part.startsWith(".")))
    )
      throw new NotFoundException("Маршрут или ресурс не найден");
  });
}
