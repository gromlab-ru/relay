import type { Backend } from "../backend/types.js";
import { toText } from "@tasks/core/domain/markdown";
import type { TaskReference } from "@tasks/core/shared/ids";
import { commentsText } from "../presentation/records.js";
import { previewText } from "../presentation/text.js";
import { creationKey, paginate } from "./pagination.js";
import type { PageOptions } from "./pagination.js";

export async function listComments(
  service: Backend["comments"],
  reference: TaskReference,
  page: PageOptions,
  actor?: string,
) {
  const { taskId, comments } = await service.records(reference);
  const items = comments
    .filter((comment) => !actor || comment.actor === actor)
    .map((comment) => ({
      id: comment.id,
      taskId,
      actor: comment.actor,
      createdAt: comment.createdAt,
      preview: previewText(toText(comment.body)),
      bytes: Buffer.byteLength(toText(comment.body)),
    }));
  return paginate(
    items,
    creationKey,
    { command: "comment.list", taskId, actor },
    page,
    true,
    commentsText,
  );
}
