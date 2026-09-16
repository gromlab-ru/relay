import assert from "node:assert/strict";
import { test } from "node:test";
import { configSchema, defaultConfig, mcpConfigSchema } from "@tasks/core/domain/config";

test("отсутствующие порты и пустые секции используют Server 4700 и MCP 4710", () => {
  const { server, ...legacy } = defaultConfig;
  assert.equal(server.port, 4700);
  assert.equal(configSchema.parse(legacy).server.port, 4700);
  assert.equal(configSchema.parse({ ...legacy, server: {} }).server.port, 4700);
  assert.equal(mcpConfigSchema.parse({}).port, 4710);
  assert.equal(configSchema.parse({ ...legacy, mcp: {} }).mcp?.port, 4710);
});

test("server.port принимает целый порт, включая 0, и отклоняет ошибочную конфигурацию", () => {
  for (const port of [0, 1, 3000, 3010, 65535]) {
    assert.equal(configSchema.parse({ ...defaultConfig, server: { port } }).server.port, port);
    assert.equal(mcpConfigSchema.parse({ port }).port, port);
  }
  for (const server of [
    { port: -1 },
    { port: 65536 },
    { port: 3000.5 },
    { port: "3001" },
    { port: null },
    { port: true },
    { port: 3001, unknown: true },
    null,
  ]) {
    assert.equal(configSchema.safeParse({ ...defaultConfig, server }).success, false);
  }
});
