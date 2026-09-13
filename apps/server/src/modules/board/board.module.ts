import { Controller, Get, Inject, Injectable, Module, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { success } from "#contracts";
import type { ApiSuccess, BoardQuery, BoardResponse } from "#contracts";
import { TaskQueries } from "#core/application/queries/tasks";
import { WorkspaceService } from "../workspace/workspace.module.js";
import { ApiEndpoint } from "../../openapi/endpoint.js";
import { boardQuerySchema } from "../../openapi/schemas.js";
import { ZodValidationPipe } from "../../common/validation.js";

@Injectable()
export class BoardService {
  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  async get(query: BoardQuery): Promise<ApiSuccess<BoardResponse>> {
    const workspace = await this.workspace.open();
    const { data, meta } = await new TaskQueries(workspace).board(query);
    return success({ context: this.workspace.context(workspace), ...data }, meta);
  }
}

@ApiTags("board")
@Controller("board")
class BoardController {
  constructor(@Inject(BoardService) private readonly board: BoardService) {}

  @Get()
  @ApiEndpoint({
    id: "getBoard",
    summary: "Получить страницу доски со всеми статусами",
    response: "BoardResponse",
    query: "BoardQuery",
    paged: true,
  })
  get(@Query(new ZodValidationPipe(boardQuerySchema, true)) query: BoardQuery) {
    return this.board.get(query);
  }
}

@Module({ controllers: [BoardController], providers: [BoardService], exports: [BoardService] })
export class BoardModule {}
