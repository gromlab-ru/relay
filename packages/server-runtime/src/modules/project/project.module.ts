import { Controller, Get, Inject, Module } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { success } from "@relay/contracts";
import { validateWorkspace } from "@relay/core/application/validate";
import { WorkspaceService } from "../workspace/workspace.module.js";
import { ApiEndpoint } from "../../openapi/endpoint.js";

@ApiTags("project")
@Controller()
class ProjectController {
  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  @Get("validation")
  @ApiEndpoint({
    id: "validateProject",
    summary: "Проверить продукт, доски, задачи и граф связей проекта",
    response: "ValidationData",
  })
  async validate() {
    return success(await validateWorkspace(await this.workspace.open()));
  }
}

@Module({ controllers: [ProjectController] })
export class ProjectModule {}
