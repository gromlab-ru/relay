import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Module,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { success } from "@relay/contracts";
import type { ChangeDependencyRequest } from "@relay/contracts";
import { ProjectQueries, taskListQuerySchema } from "@relay/core/application/queries/project";
import type { TaskListQuery } from "@relay/core/application/queries/project";
import { TaskQueries, taskCard } from "@relay/core/application/queries/tasks";
import type { OverviewQueryInput } from "@relay/core/application/queries/overview";
import { TaskService } from "@relay/core/application/tasks/service";
import { changeDependency } from "@relay/core/application/tasks/assignment";
import { validateWorkspace } from "@relay/core/application/validate";
import { WorkspaceService } from "../workspace/workspace.module.js";
import { ApiEndpoint } from "../../openapi/endpoint.js";
import {
  dependencySchema,
  projectOverviewQuerySchema,
  treeQuerySchema,
  markdownQuerySchema,
} from "../../openapi/schemas.js";
import { TaskIdPipe, ZodValidationPipe } from "../../common/validation.js";

@ApiTags("project")
@Controller()
class ProjectController {
  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  @Get("task-list")
  @ApiEndpoint({
    id: "getTaskList",
    summary: "Краткая выборка задач для терминального списка",
    response: "TaskListData",
    query: "TaskListQuery",
  })
  async list(@Query(new ZodValidationPipe(taskListQuerySchema, true)) query: TaskListQuery) {
    return success(await new ProjectQueries(await this.workspace.open()).list(query));
  }

  @Get("tasks/:id/document")
  @ApiEndpoint({
    id: "getTaskDocument",
    summary: "Полный документ и контекст задачи одним чтением",
    response: "TaskDocumentData",
    taskId: true,
  })
  async document(@Param("id", TaskIdPipe) id: number) {
    return success(await new ProjectQueries(await this.workspace.open()).document(id));
  }

  @Get("tasks/:id/markdown")
  @ApiEndpoint({
    id: "getTaskMarkdown",
    summary: "Текст задачи без загрузки истории и графа",
    response: "TaskMarkdownData",
    query: "TaskMarkdownQuery",
    taskId: true,
  })
  async markdown(
    @Param("id", TaskIdPipe) id: number,
    @Query(new ZodValidationPipe(markdownQuerySchema, true))
    query: { field: "description" | "summary" },
  ) {
    return success(await new ProjectQueries(await this.workspace.open()).markdown(id, query.field));
  }

  @Get("tasks/:id/links")
  @ApiEndpoint({
    id: "getTaskLinks",
    summary: "Связи и блокеры задачи",
    response: "TaskLinksData",
    taskId: true,
  })
  async links(@Param("id", TaskIdPipe) id: number) {
    return success(await new ProjectQueries(await this.workspace.open()).links(id));
  }

  @Get("tasks/:id/tree")
  @ApiEndpoint({
    id: "getTaskTree",
    summary: "Дерево подзадач из одного снимка",
    response: "TaskTreeData",
    query: "TreeQuery",
    taskId: true,
  })
  async tree(
    @Param("id", TaskIdPipe) id: number,
    @Query(new ZodValidationPipe(treeQuerySchema, true)) query: { depth: number },
  ) {
    return success(await new ProjectQueries(await this.workspace.open()).tree(id, query.depth));
  }

  @Get("groups")
  @ApiEndpoint({ id: "getGroups", summary: "Прогресс групп проекта", response: "GroupsData" })
  async groups() {
    return success(await new ProjectQueries(await this.workspace.open()).groups());
  }

  @Get("overview")
  @ApiEndpoint({
    id: "getOverview",
    summary: "Обзор проекта или дерева из одного снимка",
    response: "OverviewData",
    query: "OverviewQuery",
  })
  async overview(
    @Query(new ZodValidationPipe(projectOverviewQuerySchema, true))
    query: OverviewQueryInput & { rootId?: number },
  ) {
    const { rootId, ...input } = query;
    return success(await new TaskQueries(await this.workspace.open()).overview(rootId, input));
  }

  @Get("validation")
  @ApiEndpoint({
    id: "validateProject",
    summary: "Проверить документы и граф проекта",
    response: "ValidationData",
  })
  async validate() {
    return success(await validateWorkspace(await this.workspace.open()));
  }

  @Post("tasks/:id/dependencies")
  @HttpCode(200)
  @ApiEndpoint({
    id: "changeDependency",
    summary: "Атомарно добавить или удалить зависимость",
    response: "TaskCard",
    body: "ChangeDependencyRequest",
    taskId: true,
  })
  async dependency(
    @Param("id", TaskIdPipe) id: number,
    @Body(new ZodValidationPipe(dependencySchema)) input: ChangeDependencyRequest,
  ) {
    return success(
      taskCard(
        await changeDependency(
          new TaskService(await this.workspace.open()),
          id,
          input.dependencyId,
          input.action === "add",
          this.workspace.mutation(input),
        ),
      ),
    );
  }
}

@Module({ controllers: [ProjectController] })
export class ProjectModule {}
