import type { Task } from "../src/domain/task.js";
import type { ProductState as CoreProductState } from "../src/domain/product.js";
import type { ProductState } from "@relay/contracts";
import type { Config } from "../src/domain/config.js";
import type { Comment } from "../src/domain/comment.js";
import type { Log } from "../src/domain/log.js";
import type { CommentRecord, LogRecord, ProjectConfig, TaskFields } from "@relay/contracts";

type Assert<T extends true> = T;
type Assignable<Source, Target> = [Source] extends [Target] ? true : false;

/** Компиляция обнаруживает рассогласование общих DTO и реальных схем ядра. */
export type TaskFieldsMatch = Assert<Assignable<Task, TaskFields>>;
export type ConfigMatches = Assert<Assignable<Config, ProjectConfig>>;
export type CommentMatches = Assert<Assignable<Comment, CommentRecord>>;
export type LogMatches = Assert<Assignable<Log, LogRecord>>;
export type ProductMatches = Assert<Assignable<CoreProductState, ProductState>>;
