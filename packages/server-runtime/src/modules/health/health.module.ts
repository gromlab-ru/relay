import { Controller, Get, Module } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { API_CONTRACT_VERSION, success } from "@relay/contracts";
import type { ApiSuccess, HealthResponse } from "@relay/contracts";
import { ApiEndpoint } from "../../openapi/endpoint.js";

@ApiTags("health")
@Controller("health")
class HealthController {
  @Get()
  @ApiEndpoint({
    id: "getHealth",
    summary: "Проверить доступность сервера",
    response: "HealthResponse",
  })
  get(): ApiSuccess<HealthResponse> {
    return success({ status: "ok", stage: "ready", contractVersion: API_CONTRACT_VERSION });
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
