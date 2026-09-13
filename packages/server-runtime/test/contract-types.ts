import type { z } from "zod";
import type * as Contract from "@tasks/contracts";
import type { schemas } from "../src/openapi/schemas.js";

type Assert<T extends true> = T;
type Normalize<T> = T extends (infer Item)[]
  ? Normalize<Item>[]
  : T extends object
    ? {
        [Key in keyof T]: Normalize<Exclude<T[Key], undefined>>;
      }
    : T;
type Equal<Left, Right> = [Normalize<Left>] extends [Normalize<Right>]
  ? [Normalize<Right>] extends [Normalize<Left>]
    ? true
    : false
  : false;
type Input<Name extends keyof typeof schemas> = z.input<(typeof schemas)[Name]>;
type Output<Name extends keyof typeof schemas> = z.output<(typeof schemas)[Name]>;

/** Проверяются tsc: HTTP-схемы совместимы с публичными DTO в обоих направлениях. */
export type CreateMatches = Assert<Equal<Input<"CreateTaskRequest">, Contract.CreateTaskRequest>>;
export type UpdateMatches = Assert<Equal<Input<"UpdateTaskRequest">, Contract.UpdateTaskRequest>>;
export type MoveMatches = Assert<Equal<Input<"MoveTaskRequest">, Contract.MoveTaskRequest>>;
export type ClaimMatches = Assert<Equal<Input<"ClaimTaskRequest">, Contract.ClaimTaskRequest>>;
export type ReleaseMatches = Assert<
  Equal<Input<"ReleaseTaskRequest">, Contract.ReleaseTaskRequest>
>;
export type CommentMatches = Assert<Equal<Input<"AddCommentRequest">, Contract.AddCommentRequest>>;
export type LogMatches = Assert<Equal<Input<"AddLogRequest">, Contract.AddLogRequest>>;
export type BoardQueryMatches = Assert<Equal<Input<"BoardQuery">, Contract.BoardQuery>>;
export type RecordsQueryMatches = Assert<Equal<Input<"LogQuery">, Contract.RecordsQuery>>;
export type TaskMatches = Assert<Equal<Output<"TaskCard">, Contract.TaskCard>>;
export type DetailMatches = Assert<
  Equal<Output<"TaskDetailResponse">, Contract.TaskDetailResponse>
>;
export type BoardMatches = Assert<Equal<Output<"BoardResponse">, Contract.BoardResponse>>;
export type ContextMatches = Assert<Equal<Output<"ContextResponse">, Contract.ContextResponse>>;
export type HealthMatches = Assert<Equal<Output<"HealthResponse">, Contract.HealthResponse>>;
export type EventMatches = Assert<Equal<Output<"ServerEvent">, Contract.ServerEvent>>;
