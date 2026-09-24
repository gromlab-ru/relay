import { Controller, Get, Inject, Module, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { success } from "@relay/contracts";
import { progressQuerySchema, progressPageQuerySchema } from "@relay/contracts/progress";
import type { ProgressQuery, ProgressPageQuery } from "@relay/contracts/progress";
import { ProgressService } from "@relay/core/application/progress/service";
import { ApiEndpoint } from "../../openapi/endpoint.js";
import { ZodValidationPipe } from "../../common/validation.js";
import { WorkspaceService } from "../workspace/workspace.module.js";

@ApiTags("progress")
@Controller("progress")
class ProgressController {
  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  @Get("task")
  @ApiEndpoint({
    id: "getTaskProgress",
    summary: "Прочитать фактическое выполнение задачи, критерии и обязательства",
    response: "TaskProgress",
    query: "ProgressQuery",
  })
  async task(@Query(new ZodValidationPipe(progressQuerySchema)) query: ProgressQuery) {
    return success(await new ProgressService(await this.workspace.open()).task(query));
  }

  @Get("implementation")
  @ApiEndpoint({
    id: "getImplementationProgress",
    summary: "Прочитать прогресс реализации и её собственные задачи",
    response: "ImplementationProgress",
    query: "ProgressQuery",
  })
  async implementation(@Query(new ZodValidationPipe(progressQuerySchema)) query: ProgressQuery) {
    return success(await new ProgressService(await this.workspace.open()).implementation(query));
  }

  @Get("scenario")
  @ApiEndpoint({
    id: "getScenarioProgress",
    summary: "Прочитать готовность сценария и реализации приложений",
    response: "ScenarioProgress",
    query: "ProgressQuery",
  })
  async scenario(@Query(new ZodValidationPipe(progressQuerySchema)) query: ProgressQuery) {
    return success(await new ProgressService(await this.workspace.open()).scenario(query));
  }

  @Get("feature")
  @ApiEndpoint({
    id: "getFeatureProgress",
    summary: "Прочитать готовность фичи, её сценарии и реализации",
    response: "FeatureProgress",
    query: "ProgressQuery",
  })
  async feature(@Query(new ZodValidationPipe(progressQuerySchema)) query: ProgressQuery) {
    return success(await new ProgressService(await this.workspace.open()).feature(query));
  }

  @Get("application")
  @ApiEndpoint({
    id: "getApplicationProgress",
    summary: "Прочитать заявленный состав приложения и раздельные счётчики задач его досок",
    response: "ApplicationProgress",
    query: "ProgressQuery",
  })
  async application(@Query(new ZodValidationPipe(progressQuerySchema)) query: ProgressQuery) {
    return success(await new ProgressService(await this.workspace.open()).application(query));
  }

  @Get("product")
  @ApiEndpoint({
    id: "getProductProgress",
    summary: "Прочитать прогресс продукта и страницу его фич",
    response: "ProductProgress",
    query: "ProgressPageQuery",
  })
  async product(@Query(new ZodValidationPipe(progressPageQuerySchema)) query: ProgressPageQuery) {
    return success(await new ProgressService(await this.workspace.open()).product(query));
  }
}

@Module({ controllers: [ProgressController] })
export class ProgressModule {}
