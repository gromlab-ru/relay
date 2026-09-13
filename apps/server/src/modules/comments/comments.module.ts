import { Body, Controller, Get, Inject, Module, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { success } from "#contracts";
import type {
  AddCommentRequest,
  ApiSuccess,
  CommentRecord,
  RecordsPage,
  RecordsQuery,
} from "#contracts";
import { CommentService } from "#core/application/comments";
import { WorkspaceService } from "../workspace/workspace.module.js";
import { ApiEndpoint } from "../../openapi/endpoint.js";
import { addCommentSchema, commentQuerySchema } from "../../openapi/schemas.js";
import { TaskIdPipe, ZodValidationPipe } from "../../common/validation.js";

@ApiTags("comments")
@Controller("tasks/:id/comments")
class CommentsController {
  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  @Get()
  @ApiEndpoint({
    id: "listComments",
    summary: "Прочитать страницу комментариев от новых к старым",
    response: "CommentsPage",
    query: "CommentQuery",
    paged: true,
    taskId: true,
  })
  async list(
    @Param("id", TaskIdPipe) id: number,
    @Query(new ZodValidationPipe(commentQuerySchema, true)) query: RecordsQuery,
  ): Promise<ApiSuccess<RecordsPage<CommentRecord>>> {
    const service = new CommentService(await this.workspace.open());
    const { data, meta } = await service.list(id, query);
    return success(data, meta);
  }

  @Get(":commentId")
  @ApiEndpoint({
    id: "getComment",
    summary: "Прочитать комментарий целиком",
    response: "CommentRecord",
    taskId: true,
    record: "commentId",
  })
  async get(
    @Param("id", TaskIdPipe) id: number,
    @Param("commentId") commentId: string,
  ): Promise<ApiSuccess<CommentRecord>> {
    return success(await new CommentService(await this.workspace.open()).get(id, commentId));
  }

  @Post()
  @ApiEndpoint({
    id: "addComment",
    summary: "Атомарно добавить комментарий",
    response: "CommentRecord",
    body: "AddCommentRequest",
    status: 201,
    taskId: true,
  })
  async add(
    @Param("id", TaskIdPipe) id: number,
    @Body(new ZodValidationPipe(addCommentSchema)) input: AddCommentRequest,
  ): Promise<ApiSuccess<CommentRecord>> {
    return success(
      await new CommentService(await this.workspace.open()).add(
        id,
        input.text,
        this.workspace.options.actor,
      ),
    );
  }
}

@Module({ controllers: [CommentsController] })
export class CommentsModule {}
