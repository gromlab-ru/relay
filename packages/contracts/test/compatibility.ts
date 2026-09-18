import type { Task } from "@relay/core/domain/task";
import type { ProductState as CoreProductState } from "@relay/core/domain/product";
import type { ProductState } from "@relay/contracts";
import type { Config } from "@relay/core/domain/config";
import type { Comment } from "@relay/core/domain/comment";
import type { Log } from "@relay/core/domain/log";
import type { CommentRecord, LogRecord, ProjectConfig, TaskFields } from "@relay/contracts";

type Assert<T extends true> = T;
type Assignable<Source, Target> = [Source] extends [Target] ? true : false;

/** Компиляция обнаруживает рассогласование общих DTO и реальных схем ядра. */
export type TaskFieldsMatch = Assert<Assignable<Task, TaskFields>>;
export type ConfigMatches = Assert<Assignable<Config, ProjectConfig>>;
export type CommentMatches = Assert<Assignable<Comment, CommentRecord>>;
export type LogMatches = Assert<Assignable<Log, LogRecord>>;
export type ProductMatches = Assert<Assignable<CoreProductState, ProductState>>;
