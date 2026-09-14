import { Global, Inject, Injectable, Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { createHash } from "node:crypto";
import { basename, dirname } from "node:path";
import type { ContextResponse } from "@tasks/contracts";
import { AppError } from "@tasks/core/shared/errors";
import { openWorkspace } from "@tasks/core/storage/workspace";
import type { Workspace } from "@tasks/core/storage/workspace";
import { actorSchema, parse } from "@tasks/core/domain/validation";

export interface WorkspaceOptions {
  cwd: string;
  configPath: string;
  actor: string;
}
const WORKSPACE_OPTIONS = Symbol("WORKSPACE_OPTIONS");

@Injectable()
export class WorkspaceService {
  readonly projectId: string;

  constructor(@Inject(WORKSPACE_OPTIONS) readonly options: WorkspaceOptions) {
    this.projectId = createHash("sha256").update(options.configPath).digest("hex").slice(0, 24);
  }

  /** Каждый запрос получает собственный неизменяемый контекст актуального конфига. */
  async open(): Promise<Workspace> {
    try {
      return await openWorkspace(this.options.cwd, this.options.configPath);
    } catch (error) {
      if (error instanceof AppError && error.code === "VALIDATION_ERROR")
        throw new AppError("INVALID_CONFIG", "Конфигурация проекта некорректна", 5, error.details);
      throw error;
    }
  }

  actor(override?: string): string {
    return parse(actorSchema, override ?? this.options.actor, "автор запроса");
  }

  mutation(input: { actor?: string; ifRevision?: number }) {
    return {
      actor: this.actor(input.actor),
      ...(input.ifRevision === undefined ? {} : { ifRevision: input.ifRevision }),
    };
  }

  context(workspace: Workspace): ContextResponse {
    return {
      project: basename(dirname(workspace.configPath)),
      capabilities: ["cli-http-v1", "record-request-v1"],
      projectId: this.projectId,
      configPath: workspace.configPath,
      storagePath: workspace.root,
      actor: this.options.actor,
      config: workspace.config,
    };
  }
}

@Global()
@Module({})
export class WorkspaceModule {
  static register(options: WorkspaceOptions): DynamicModule {
    return {
      module: WorkspaceModule,
      providers: [{ provide: WORKSPACE_OPTIONS, useValue: options }, WorkspaceService],
      exports: [WorkspaceService],
    };
  }
}
