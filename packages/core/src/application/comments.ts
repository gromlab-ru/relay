import { commentSchema } from "../domain/comment.js";
import type { Comment } from "../domain/comment.js";
import { parse } from "../domain/validation.js";
import { toLines } from "../domain/markdown.js";
import { assertId, newId } from "../shared/ids.js";
import type { TaskReference } from "../shared/ids.js";
import { invariant } from "../shared/errors.js";
import type { Workspace } from "../storage/workspace.js";
import { TaskService } from "./tasks/service.js";

export class CommentService {
  private readonly tasks: TaskService;
  constructor(workspace: Workspace) {
    this.tasks = new TaskService(workspace);
  }

  async add(reference: TaskReference, text: string, actor: string): Promise<Comment> {
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

  async get(reference: TaskReference, id: string): Promise<Comment> {
    assertId(id, "cmt");
    const task = await this.tasks.repository.resolve(reference);
    const comment = task.comments[id];
    invariant(comment, "COMMENT_NOT_FOUND", "Комментарий не найден в указанной задаче", 3);
    return comment;
  }

  async records(reference: TaskReference) {
    const task = await this.tasks.repository.resolve(reference);
    return { taskId: task.id, comments: Object.values(task.comments) };
  }
}
