import type { Task } from "#core/domain/task";
import type { Config } from "#core/domain/config";
import type { Comment } from "#core/domain/comment";
import type { Log } from "#core/domain/log";
import type { CommentRecord, LogRecord, ProjectConfig, TaskFields } from "../src/index.js";

type Assert<T extends true> = T;
type Assignable<Source, Target> = [Source] extends [Target] ? true : false;

/** Компиляция обнаруживает рассогласование общих DTO и реальных схем ядра. */
export type TaskFieldsMatch = Assert<Assignable<Task, TaskFields>>;
export type ConfigMatches = Assert<Assignable<Config, ProjectConfig>>;
export type CommentMatches = Assert<Assignable<Comment, CommentRecord>>;
export type LogMatches = Assert<Assignable<Log, LogRecord>>;
