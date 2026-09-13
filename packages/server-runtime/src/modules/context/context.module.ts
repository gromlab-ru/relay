import { Controller, Get, Inject, Module } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { success } from "@tasks/contracts";
import type { ApiSuccess, ContextResponse } from "@tasks/contracts";
import { WorkspaceService } from "../workspace/workspace.module.js";
import { ApiEndpoint } from "../../openapi/endpoint.js";

@ApiTags("context")
@Controller("context")
class ContextController {
  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  @Get()
  @ApiEndpoint({
    id: "getContext",
    summary: "Получить проект, автора и конфигурацию",
    response: "ContextResponse",
  })
  async get(): Promise<ApiSuccess<ContextResponse>> {
    return success(this.workspace.context(await this.workspace.open()));
  }
}

@Module({ controllers: [ContextController] })
export class ContextModule {}
