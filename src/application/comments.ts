import { commentSchema } from "../domain/comment.js";
import type { Comment } from "../domain/comment.js";
import { parse } from "../domain/validation.js";
import { toLines, toText } from "../domain/markdown.js";
import { assertId, newId } from "../shared/ids.js";
import { invariant } from "../shared/errors.js";
import type { Workspace } from "../storage/workspace.js";
import { commentsText } from "../presentation/records.js";
import { previewText } from "../presentation/text.js";
import { creationKey, paginate } from "./pagination.js";
import type { PageOptions } from "./pagination.js";
import { TaskService } from "./tasks/service.js";

export class CommentService {
  private readonly tasks: TaskService;
  constructor(workspace: Workspace) {
    this.tasks = new TaskService(workspace);
  }

  async add(reference: string, text: string, actor: string): Promise<Comment> {
    const id = newId("cmt");
    const updated = await this.tasks.mutate(reference, { actor }, (task) => {
      const comment = parse(
        commentSchema,
        {
          version: 1,
          id,
          taskId: task.id,
          actor,
          body: toLines(text),
          createdAt: new Date().toISOString(),
        },
        "комментарий",
      );
      return { comments: { ...task.comments, [id]: comment } };
    });
    return updated.comments[id]!;
  }

  async get(reference: string, id: string): Promise<Comment> {
    assertId(id, "cmt");
    const task = await this.tasks.repository.resolve(reference);
    const comment = task.comments[id];
    invariant(comment, "COMMENT_NOT_FOUND", "Комментарий не найден в указанной задаче", 3);
    return comment;
  }

  async list(reference: string, page: PageOptions, actor?: string) {
    const task = await this.tasks.repository.resolve(reference);
    const items = Object.values(task.comments)
      .filter((comment) => !actor || comment.actor === actor)
      .map((comment) => ({
        id: comment.id,
        taskId: task.id,
        actor: comment.actor,
        createdAt: comment.createdAt,
        preview: previewText(toText(comment.body)),
        bytes: Buffer.byteLength(toText(comment.body)),
      }));
    return paginate(
      items,
      creationKey,
      { command: "comment.list", taskId: task.id, actor },
      page,
      true,
      commentsText,
    );
  }
}
