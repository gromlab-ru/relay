import { Body, Controller, Delete, Get, Inject, Module, Param, Put } from "@nestjs/common";
import { ApiParam, ApiTags } from "@nestjs/swagger";
import { success } from "@tasks/contracts";
import { z } from "zod";
import { parse } from "@tasks/core/domain/validation";
import { projectEntrySchema, projectNameSchema } from "@tasks/project-runtime/config";
import { ApiEndpoint } from "../../openapi/endpoint.js";
import { ProjectCatalog } from "./catalog.js";

@ApiTags("server")
@Controller("server")
class ServerController {
  constructor(@Inject(ProjectCatalog) private readonly catalog: ProjectCatalog) {}

  @Get()
  @ApiEndpoint({
    id: "getServerContext",
    summary: "Режим Relay и доступные проекты",
    response: "ServerContextResponse",
  })
  async context() {
    return success(await this.catalog.context());
  }
}

@ApiTags("projects")
@Controller("projects")
class ProjectsController {
  constructor(@Inject(ProjectCatalog) private readonly catalog: ProjectCatalog) {}

  @Get()
  @ApiEndpoint({ id: "getProjects", summary: "Проекты сервера", response: "ServerContextResponse" })
  async list() {
    return success(await this.catalog.context());
  }

  @Put(":project")
  @ApiParam({ name: "project", type: String })
  @ApiEndpoint({
    id: "registerProject",
    summary: "Зарегистрировать проект workspace",
    body: "RegisterProjectRequest",
    response: "ServerContextResponse",
  })
  async register(@Param("project") project: string, @Body() input: unknown) {
    const { replace, ...entry } = parse(
      projectEntrySchema.safeExtend({ replace: z.boolean().default(false) }),
      input,
      "регистрация проекта",
    );
    await this.catalog.register(parse(projectNameSchema, project, "проект"), entry, replace);
    return success(await this.catalog.context());
  }

  @Delete(":project")
  @ApiParam({ name: "project", type: String })
  @ApiEndpoint({
    id: "unregisterProject",
    summary: "Удалить регистрацию проекта",
    response: "ServerContextResponse",
  })
  async unregister(@Param("project") project: string) {
    await this.catalog.unregister(parse(projectNameSchema, project, "проект"));
    return success(await this.catalog.context());
  }
}

@Module({ controllers: [ServerController, ProjectsController] })
export class ServerModule {}
