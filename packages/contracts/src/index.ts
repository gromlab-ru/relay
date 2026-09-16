/** Публичные переносимые DTO. Здесь нет импортов Core, NestJS, Node.js или React. */
export const API_PREFIX = "/api/v1";
export const API_CONTRACT_VERSION = 1 as const;
export const API_DOCS_PATH = "/api/docs";
export const OPENAPI_PATH = "/api/openapi.json";

export type RelayMode = "local" | "workspace";
export interface RelayProject {
  key: string;
  id: string;
  name: string;
  configPath: string;
  available: boolean;
  error?: string;
}
export interface ServerContextResponse {
  mode: RelayMode;
  configPath: string;
  projects: RelayProject[];
  defaultProject: string | null;
}

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
  error: { code: string; message: string; exitCode?: number; details?: unknown };
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
  mode: "local";
  projectId?: string | undefined;
  storageDir: string;
  defaultStatus: string;
  readyStatuses: string[];
  statuses: Record<string, StatusDefinition>;
  /** Настроенный порт сервера; 0 выбирает свободный порт при запуске. */
  server: { port: number; url?: string | undefined };
  mcp?: { port: number } | undefined;
  output: { format: "text" | "json"; defaultLimit: number; maxBytes: number };
}
export interface ContextResponse {
  capabilities?: string[];
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
  planId?: string;
  stageId?: string;
  type?: "task" | "feature" | "bug" | "research" | "debt";
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
export interface MutationMetadata {
  /** Автор конкретной операции; без него используется автор сервера. */
  actor?: string;
}
export type CreateTaskRequest = Pick<TaskFields, "title"> &
  Partial<Omit<TaskFields, "title">> &
  MutationMetadata;
export interface UpdateTaskRequest extends MutationMetadata {
  patch: Partial<TaskFields>;
  ifRevision?: number;
}
export interface MoveTaskRequest extends MutationMetadata {
  status: string;
  beforeId: number | null;
  ifRevision: number;
}
export interface ClaimTaskRequest extends MutationMetadata {
  ifRevision?: number;
  status?: string;
}
export interface ReleaseTaskRequest extends MutationMetadata {
  ifRevision?: number;
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
export interface AddCommentRequest extends MutationMetadata {
  text: string;
  /** Ключ идемпотентности в пределах задачи и типа записи. */
  requestId?: string;
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

export interface ChangeDependencyRequest extends MutationMetadata {
  dependencyId: number;
  action: "add" | "remove";
  ifRevision?: number;
}

export type TaskBrief = Pick<
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
>;
export interface TaskListQuery {
  planId?: string;
  stageId?: string;
  type?: "task" | "feature" | "bug" | "research" | "debt";
  status?: string;
  group?: string;
  assignee?: string;
  parent?: string | number;
  tag?: string;
  search?: string;
  ready?: boolean;
  all?: boolean;
  sort?: "id" | "board";
}
export interface TaskListData {
  items: (TaskBrief & { blockedBy: number[] })[];
  readyIds: number[];
}
export type TaskReference = Pick<TaskCard, "id" | "title" | "status">;
export interface TaskDocument extends Omit<TaskCard, "commentCount" | "logCount"> {
  comments: Record<string, CommentRecord>;
  logs: Record<string, LogRecord>;
}
export interface TaskDocumentData {
  task: TaskDocument;
  related: TaskReference[];
  blockedBy: number[];
  ready: boolean;
}
export interface TaskMarkdownQuery {
  field: "description" | "summary";
}
export interface TaskMarkdownData {
  id: number;
  lines: string[];
}
export interface TaskLinksData {
  task: TaskReference;
  id: number;
  parent: TaskReference | null;
  children: TaskReference[];
  dependsOn: TaskReference[];
  blocks: TaskReference[];
  blockedBy: number[];
}
export interface TaskTreeData {
  items: (TaskBrief & { depth: number })[];
  truncated: boolean;
  blockedCounts: Record<string, number>;
}
export type GroupsData = { name: string; total: number; completed: number; terminal: number }[];
export interface ValidationData {
  valid: boolean;
  tasks: number;
  comments: number;
  logs: number;
}
export interface OverviewQuery {
  rootId?: number;
  limit?: number;
  reviewStatuses?: string[];
}
export type OverviewTask = Pick<
  TaskCard,
  "id" | "title" | "status" | "group" | "assignee" | "parentId" | "revision"
> & { blockedByCount: number };
export interface OverviewCounts {
  total: number;
  open: number;
  completed: number;
  terminal: number;
  byStatus: Record<string, number>;
}
export interface OverviewImpact {
  blockedCount: number;
  unblocksCount: number;
  readyAfterCompletionCount: number;
}
export interface OverviewSection<T> {
  total: number;
  items: T[];
}
export interface OverviewData {
  root: OverviewTask | null;
  version: string;
  limit: number;
  counts: OverviewCounts;
  leafCounts: OverviewCounts;
  reviewStatuses: string[];
  progress: OverviewSection<OverviewTask & { children: OverviewCounts }>;
  ready: OverviewSection<OverviewTask>;
  review: OverviewSection<OverviewTask & OverviewImpact>;
  blockers: OverviewSection<OverviewTask & OverviewImpact & { outsideScope: boolean }>;
}

export type ServerEvent =
  | { type: "connected"; data: { projectId: string } }
  | { type: "heartbeat"; data: { timestamp: string } }
  | { type: "changed"; data: { source: "api" | "storage"; taskIds?: number[]; version?: string } }
  | { type: "workspace-error"; data: { code: string; message: string } };
