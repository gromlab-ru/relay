import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { success } from "#contracts";
import type {
  ApiSuccess,
  BoardQuery,
  ClaimTaskRequest,
  CreateTaskRequest,
  MoveTaskRequest,
  ReleaseTaskRequest,
  TaskCard,
  TaskDetailResponse,
  UpdateTaskRequest,
} from "#contracts";
import { TaskService } from "#core/application/tasks/service";
import { TaskQueries, taskCard } from "#core/application/queries/tasks";
import { claimTask, releaseTask } from "#core/application/tasks/assignment";
import { moveTask } from "#core/application/tasks/move";
import { WorkspaceService } from "../workspace/workspace.module.js";
import { BoardModule, BoardService } from "../board/board.module.js";
import { ApiEndpoint } from "../../openapi/endpoint.js";
import {
  boardQuerySchema,
  claimTaskSchema,
  createTaskSchema,
  moveTaskSchema,
  releaseTaskSchema,
  updateTaskSchema,
} from "../../openapi/schemas.js";
import { TaskIdPipe, ZodValidationPipe } from "../../common/validation.js";

@ApiTags("tasks")
@Controller("tasks")
class TasksController {
  constructor(
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
    @Inject(BoardService) private readonly board: BoardService,
  ) {}

  @Get()
  @ApiEndpoint({
    id: "listTasks",
    summary: "Получить страницу задач",
    response: "BoardResponse",
    query: "BoardQuery",
    paged: true,
  })
  list(@Query(new ZodValidationPipe(boardQuerySchema, true)) query: BoardQuery) {
    return this.board.get(query);
  }

  @Get(":id")
  @ApiEndpoint({
    id: "getTask",
    summary: "Получить карточку, связи и блокеры",
    response: "TaskDetailResponse",
    taskId: true,
  })
  async get(@Param("id", TaskIdPipe) id: number): Promise<ApiSuccess<TaskDetailResponse>> {
    return success(await new TaskQueries(await this.workspace.open()).detail(id));
  }

  @Post()
  @ApiEndpoint({
    id: "createTask",
    summary: "Создать задачу",
    response: "TaskCard",
    body: "CreateTaskRequest",
    status: 201,
  })
  async create(
    @Body(new ZodValidationPipe(createTaskSchema)) input: CreateTaskRequest,
  ): Promise<ApiSuccess<TaskCard>> {
    const service = new TaskService(await this.workspace.open());
    return success(taskCard(await service.create(input, this.workspace.options.actor)));
  }

  @Patch(":id")
  @ApiEndpoint({
    id: "updateTask",
    summary: "Изменить поля с проверкой ревизии",
    response: "TaskCard",
    body: "UpdateTaskRequest",
    taskId: true,
  })
  async update(
    @Param("id", TaskIdPipe) id: number,
    @Body(new ZodValidationPipe(updateTaskSchema)) input: UpdateTaskRequest,
  ): Promise<ApiSuccess<TaskCard>> {
    const service = new TaskService(await this.workspace.open());
    return success(
      taskCard(
        await service.update(id, input.patch, {
          actor: this.workspace.options.actor,
          ifRevision: input.ifRevision,
        }),
      ),
    );
  }

  @Post(":id/move")
  @HttpCode(200)
  @ApiEndpoint({
    id: "moveTask",
    summary: "Атомарно изменить статус и позицию карточки",
    response: "TaskCard",
    body: "MoveTaskRequest",
    taskId: true,
  })
  async move(
    @Param("id", TaskIdPipe) id: number,
    @Body(new ZodValidationPipe(moveTaskSchema)) input: MoveTaskRequest,
  ): Promise<ApiSuccess<TaskCard>> {
    const service = new TaskService(await this.workspace.open());
    return success(
      taskCard(
        await moveTask(service, id, input.status, input.beforeId, {
          actor: this.workspace.options.actor,
          ifRevision: input.ifRevision,
        }),
      ),
    );
  }

  @Post(":id/claim")
  @HttpCode(200)
  @ApiEndpoint({
    id: "claimTask",
    summary: "Назначить готовую задачу на автора сервера",
    response: "TaskCard",
    body: "ClaimTaskRequest",
    taskId: true,
  })
  async claim(
    @Param("id", TaskIdPipe) id: number,
    @Body(new ZodValidationPipe(claimTaskSchema)) input: ClaimTaskRequest,
  ): Promise<ApiSuccess<TaskCard>> {
    const service = new TaskService(await this.workspace.open());
    return success(
      taskCard(
        await claimTask(
          service,
          id,
          { actor: this.workspace.options.actor, ifRevision: input.ifRevision },
          input.status,
        ),
      ),
    );
  }

  @Post(":id/release")
  @HttpCode(200)
  @ApiEndpoint({
    id: "releaseTask",
    summary: "Снять назначение, сохранив статус",
    response: "TaskCard",
    body: "ReleaseTaskRequest",
    taskId: true,
  })
  async release(
    @Param("id", TaskIdPipe) id: number,
    @Body(new ZodValidationPipe(releaseTaskSchema)) input: ReleaseTaskRequest,
  ): Promise<ApiSuccess<TaskCard>> {
    const service = new TaskService(await this.workspace.open());
    return success(
      taskCard(
        await releaseTask(
          service,
          id,
          { actor: this.workspace.options.actor, ifRevision: input.ifRevision },
          input.force ?? false,
        ),
      ),
    );
  }
}

@Module({ imports: [BoardModule], controllers: [TasksController] })
export class TasksModule {}
