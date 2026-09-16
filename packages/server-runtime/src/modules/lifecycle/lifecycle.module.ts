import { Body, Controller, Get, HttpCode, Inject, Module, Param, Post } from "@nestjs/common";
import { ApiParam, ApiTags } from "@nestjs/swagger";
import { success } from "@tasks/contracts";
import { LifecycleQueries } from "@tasks/core/application/project/queries";
import { ProjectService } from "@tasks/core/application/project/service";
import { projectRecordIdSchema, saveProjectRecordSchema } from "@tasks/core/domain/project";
import type { SaveProjectRecord } from "@tasks/core/domain/project";
import { parse } from "@tasks/core/domain/validation";
import { ApiEndpoint } from "../../openapi/endpoint.js";
import { TaskIdPipe, ZodValidationPipe } from "../../common/validation.js";
import { WorkspaceService } from "../workspace/workspace.module.js";

@ApiTags("lifecycle")
@Controller("project")
class LifecycleController {
  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  @Get("state")
  @ApiEndpoint({
    id: "getProjectState",
    summary: "Паспорт, планы и фактическое состояние выбранного проекта",
    response: "ProjectState",
  })
  async state() {
    return success(await new LifecycleQueries(await this.workspace.open()).state());
  }

  @Get("context")
  @ApiEndpoint({
    id: "getProjectContext",
    summary: "Компактный контекст для оркестратора",
    response: "ProjectContext",
  })
  async context() {
    return success(await new LifecycleQueries(await this.workspace.open()).context());
  }

  @Get("tasks/:id/briefing")
  @ApiEndpoint({
    id: "getTaskBriefing",
    summary: "Готовое поручение работнику с требованиями и границами",
    response: "TaskBriefing",
    taskId: true,
  })
  async briefing(@Param("id", TaskIdPipe) id: number) {
    return success(await new LifecycleQueries(await this.workspace.open()).briefing(id));
  }

  @Get("checkpoints/:recordId/changes")
  @ApiParam({ name: "recordId", schema: { type: "string" } })
  @ApiEndpoint({
    id: "getCheckpointChanges",
    summary: "Изменения после контрольной точки",
    response: "CheckpointChanges",
  })
  async changes(@Param("recordId") id: string) {
    return success(
      await new LifecycleQueries(await this.workspace.open()).changes(
        parse(projectRecordIdSchema, id, "ID контрольной точки"),
      ),
    );
  }

  @Post("records")
  @HttpCode(200)
  @ApiEndpoint({
    id: "saveProjectRecord",
    summary: "Создать или обновить проектный документ с проверкой ревизии",
    response: "ProjectRecord",
    body: "SaveProjectRecord",
  })
  async save(@Body(new ZodValidationPipe(saveProjectRecordSchema)) input: SaveProjectRecord) {
    return success(
      await new ProjectService(await this.workspace.open()).save(input, this.workspace.actor()),
    );
  }
}

@Module({ controllers: [LifecycleController] })
export class LifecycleModule {}
