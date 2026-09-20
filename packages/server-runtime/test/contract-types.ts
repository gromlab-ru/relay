import type { z } from "zod";
import type * as Contract from "@relay/contracts";
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
type Output<Name extends keyof typeof schemas> = z.output<(typeof schemas)[Name]>;

/** Проверяются tsc: HTTP-схемы совместимы с публичными DTO в обоих направлениях. */
export type ContextMatches = Assert<Equal<Output<"ContextResponse">, Contract.ContextResponse>>;
export type HealthMatches = Assert<Equal<Output<"HealthResponse">, Contract.HealthResponse>>;
export type EventMatches = Assert<Equal<Output<"ServerEvent">, Contract.ServerEvent>>;
export type ValidationMatches = Assert<Equal<Output<"ValidationData">, Contract.ValidationData>>;
