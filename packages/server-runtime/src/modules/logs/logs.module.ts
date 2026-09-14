import { Body, Controller, Get, Inject, Module, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { success } from "@tasks/contracts";
import type {
  AddLogRequest,
  ApiSuccess,
  LogRecord,
  RecordsPage,
  RecordsQuery,
} from "@tasks/contracts";
import { LogService } from "@tasks/core/application/logs/service";
import { toLines } from "@tasks/core/domain/markdown";
import { WorkspaceService } from "../workspace/workspace.module.js";
import { ApiEndpoint } from "../../openapi/endpoint.js";
import { addLogSchema, logQuerySchema } from "../../openapi/schemas.js";
import { TaskIdPipe, ZodValidationPipe } from "../../common/validation.js";

@ApiTags("logs")
@Controller("tasks/:id/logs")
class LogsController {
  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  @Get()
  @ApiEndpoint({
    id: "listLogs",
    summary: "Прочитать страницу отчётов от новых к старым",
    response: "LogsPage",
    query: "LogQuery",
    paged: true,
    taskId: true,
  })
  async list(
    @Param("id", TaskIdPipe) id: number,
    @Query(new ZodValidationPipe(logQuerySchema, true)) query: RecordsQuery,
  ): Promise<ApiSuccess<RecordsPage<LogRecord>>> {
    const { data, meta } = await new LogService(await this.workspace.open()).list(id, query);
    return success(data, meta);
  }

  @Get(":logId")
  @ApiEndpoint({
    id: "getLog",
    summary: "Прочитать отчёт целиком",
    response: "LogRecord",
    taskId: true,
    record: "logId",
  })
  async get(
    @Param("id", TaskIdPipe) id: number,
    @Param("logId") logId: string,
  ): Promise<ApiSuccess<LogRecord>> {
    return success(await new LogService(await this.workspace.open()).get(id, logId));
  }

  @Post()
  @ApiEndpoint({
    id: "addLog",
    summary: "Атомарно добавить отчёт",
    response: "LogRecord",
    body: "AddLogRequest",
    status: 201,
    taskId: true,
  })
  async add(
    @Param("id", TaskIdPipe) id: number,
    @Body(new ZodValidationPipe(addLogSchema)) input: AddLogRequest,
  ): Promise<ApiSuccess<LogRecord>> {
    const { text, summary, actor, requestId, ...fields } = input;
    return success(
      await new LogService(await this.workspace.open()).add(
        id,
        {
          ...fields,
          body: toLines(text),
          ...(summary === undefined ? {} : { summary: toLines(summary) }),
        },
        this.workspace.actor(actor),
        requestId,
      ),
    );
  }
}

@Module({ controllers: [LogsController] })
export class LogsModule {}
