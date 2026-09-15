import { Inject, Injectable } from "@nestjs/common";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { tap } from "rxjs";
import { EventsService } from "./events.service.js";
import { PROJECT_SELECTOR } from "../workspace/routing.js";

@Injectable()
export class MutationEventsInterceptor implements NestInterceptor {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const raw = request.raw as typeof request.raw & { [PROJECT_SELECTOR]?: string };
    const project = raw[PROJECT_SELECTOR];
    if (!["POST", "PATCH"].includes(request.method)) return next.handle();
    return next.handle().pipe(
      tap((result: unknown) => {
        if (
          !result ||
          typeof result !== "object" ||
          !("ok" in result) ||
          result.ok !== true ||
          !("data" in result)
        )
          return;
        const data = result.data;
        if (!data || typeof data !== "object") return;
        const taskId = "taskId" in data ? data.taskId : "id" in data ? data.id : undefined;
        if (typeof taskId === "number")
          void this.events.apiChanged(project, taskId).catch(() => {});
      }),
    );
  }
}
