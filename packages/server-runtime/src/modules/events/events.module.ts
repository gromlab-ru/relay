import { Controller, Inject, Module, Sse } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ApiExtension, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { EventsService } from "./events.service.js";
import { MutationEventsInterceptor } from "./mutation-events.interceptor.js";
import { ref } from "../../openapi/endpoint.js";
import { WorkspaceService } from "../workspace/workspace.module.js";

@ApiTags("events")
@Controller("events")
class EventsController {
  constructor(
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
  ) {}

  @Sse()
  @ApiOperation({
    operationId: "watchEvents",
    summary: "Подписаться на изменения проекта",
    description:
      "SSE-уведомления connected, changed и workspace-error; heartbeat каждые 15 секунд поддерживает поток при простое и не требует перечитывать REST. Поле event соответствует type, JSON в data — полю data схемы ServerEvent. После подключения и восстановления соединения перечитайте REST. Доставка может объединять и повторять изменения; воспроизведение по Last-Event-ID не поддерживается.",
  })
  @ApiExtension("x-sse-event-schema", ref("ServerEvent"))
  @ApiResponse({
    status: 200,
    description: "Поток событий до отключения клиента или остановки сервера",
    content: {
      "text/event-stream": {
        schema: { type: "string" },
        example: 'event: changed\ndata: {"source":"storage","taskIds":[12]}\n\n',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Источник запроса не разрешён",
    schema: ref("ApiFailure"),
  })
  get() {
    return this.events.stream(this.workspace);
  }
}

@Module({
  controllers: [EventsController],
  providers: [EventsService, { provide: APP_INTERCEPTOR, useClass: MutationEventsInterceptor }],
  exports: [EventsService],
})
export class EventsModule {}
