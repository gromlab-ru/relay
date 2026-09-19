import { Controller, Get, Inject, Module, Param, Query } from "@nestjs/common";
import { ApiParam, ApiTags } from "@nestjs/swagger";
import { success } from "@relay/contracts";
import { BoardsService } from "@relay/core/application/boards/service";
import { boardSlugSchema, boardsQuerySchema } from "@relay/core/domain/board";
import type { BoardsQuery } from "@relay/core/domain/board";
import { ApiEndpoint } from "../../openapi/endpoint.js";
import { ZodValidationPipe } from "../../common/validation.js";
import { WorkspaceService } from "../workspace/workspace.module.js";

@ApiTags("boards")
@Controller("boards")
class BoardsController {
  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  @Get()
  @ApiEndpoint({
    id: "getBoards",
    summary: "Каталог досок проекта с продолжением и проверкой версии",
    response: "BoardsPage",
    query: "BoardsQuery",
  })
  async list(@Query(new ZodValidationPipe(boardsQuerySchema)) query: BoardsQuery) {
    return success(await new BoardsService(await this.workspace.open()).list(query));
  }

  @Get(":slug")
  @ApiParam({
    name: "slug",
    description: "Slug доски выбранного проекта",
    schema: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", maxLength: 64 },
  })
  @ApiEndpoint({
    id: "getBoardBySlug",
    summary: "Прочитать доску по slug; неизвестный адрес возвращает 404",
    response: "BoardInfo",
  })
  async get(@Param("slug", new ZodValidationPipe(boardSlugSchema)) slug: string) {
    return success(await new BoardsService(await this.workspace.open()).get(slug));
  }
}

@Module({ controllers: [BoardsController] })
export class BoardsModule {}
