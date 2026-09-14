/** Публичные переносимые DTO. Здесь нет импортов Core, NestJS, Node.js или React. */
export const API_PREFIX = "/api/v1";
export const API_CONTRACT_VERSION = 1 as const;
export const API_DOCS_PATH = "/api/docs";
export const OPENAPI_PATH = "/api/openapi.json";

export interface PageMeta {
  hasMore: boolean;
  nextCursor: string | null;
  truncated?: boolean;
}
export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta?: PageMeta;
}
export interface ApiFailure {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
export function success<T>(data: T, meta?: PageMeta): ApiSuccess<T> {
  return { ok: true, data, ...(meta === undefined ? {} : { meta }) };
}

export type StatusColor =
  "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white" | "gray" | "none";
export interface StatusDefinition {
  terminal: boolean;
  satisfiesDependencies: boolean;
  color?: StatusColor | undefined;
}
export interface ProjectConfig {
  version: 1;
  storageDir: string;
  defaultStatus: string;
  readyStatuses: string[];
  statuses: Record<string, StatusDefinition>;
  /** Настроенный порт сервера; 0 выбирает свободный порт при запуске. */
  server: { port: number };
  output: { format: "text" | "json"; defaultLimit: number; maxBytes: number };
}
export interface ContextResponse {
  project: string;
  projectId: string;
  configPath: string;
  storagePath: string;
  actor: string;
  config: ProjectConfig;
}
export interface HealthResponse {
  status: "ok";
  stage: "scaffold" | "ready";
  contractVersion: typeof API_CONTRACT_VERSION;
}

export type Markdown = string[];
export interface TaskFields {
  title: string;
  description: Markdown;
  summary: Markdown;
  status: string;
  group: string | null;
  tags: string[];
  parentId: number | null;
  dependsOn: number[];
  assignee: string | null;
}
export interface TaskCard extends TaskFields {
  version: 2;
  id: number;
  rank?: string | undefined;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  commentCount: number;
  logCount: number;
}
export interface BoardCard extends Pick<
  TaskCard,
  | "id"
  | "title"
  | "status"
  | "group"
  | "tags"
  | "parentId"
  | "assignee"
  | "revision"
  | "createdAt"
  | "updatedAt"
  | "commentCount"
  | "logCount"
> {
  rank: string;
  blockedBy: number[];
  ready: boolean;
  childrenCount: number;
  childrenCompleted: number;
}
export interface BoardResponse {
  context: ContextResponse;
  items: BoardCard[];
  total: number;
  counts: Record<string, number>;
  groups: string[];
  /** Полные размеры групп проекта до фильтрации и пагинации; null — без группы. */
  groupCounts: { group: string | null; count: number }[];
  assignees: string[];
  tags: string[];
  version: string;
}
export interface BoardQuery {
  search?: string;
  status?: string;
  group?: string;
  assignee?: string;
  tag?: string;
  ready?: boolean;
  blocked?: boolean;
  unassigned?: boolean;
  ungrouped?: boolean;
  limit?: number;
  cursor?: string;
}
export interface TaskDetailResponse {
  task: TaskCard;
  blockedBy: number[];
  ready: boolean;
  parent: BoardCard | null;
  children: BoardCard[];
  dependencies: BoardCard[];
  blocks: BoardCard[];
}
export type CreateTaskRequest = Pick<TaskFields, "title"> & Partial<Omit<TaskFields, "title">>;
export interface UpdateTaskRequest {
  patch: Partial<TaskFields>;
  ifRevision: number;
}
export interface MoveTaskRequest {
  status: string;
  beforeId: number | null;
  ifRevision: number;
}
export interface ClaimTaskRequest {
  ifRevision: number;
  status?: string;
}
export interface ReleaseTaskRequest {
  ifRevision: number;
  force?: boolean;
}

export interface CommentRecord {
  version: 1;
  id: string;
  taskId: number;
  actor: string;
  createdAt: string;
  body: Markdown;
}
export type LogKind = "progress" | "decision" | "execution" | "error" | "summary";
export interface LogRecord extends CommentRecord {
  kind: LogKind;
  title: string;
  summary: Markdown;
  sessionId: string | null;
}
export interface RecordsPage<T> {
  items: T[];
}
export interface AddCommentRequest {
  text: string;
}
export interface AddLogRequest extends AddCommentRequest {
  kind?: LogKind;
  title?: string;
  summary?: string;
  sessionId?: string;
}
export interface RecordsQuery {
  author?: string;
  kind?: LogKind;
  search?: string;
  limit?: number;
  cursor?: string;
}

export type ServerEvent =
  | { type: "connected"; data: { projectId: string } }
  | { type: "heartbeat"; data: { timestamp: string } }
  | { type: "changed"; data: { source: "api" | "storage"; taskIds?: number[]; version?: string } }
  | { type: "workspace-error"; data: { code: string; message: string } };
