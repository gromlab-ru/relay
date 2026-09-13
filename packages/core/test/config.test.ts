import assert from "node:assert/strict";
import { test } from "node:test";
import { configSchema, defaultConfig } from "@tasks/core/domain/config";

test("старый конфиг и пустая секция server используют порт 3000", () => {
  const { server, ...legacy } = defaultConfig;
  assert.equal(server.port, 3000);
  assert.equal(configSchema.parse(legacy).server.port, 3000);
  assert.equal(configSchema.parse({ ...legacy, server: {} }).server.port, 3000);
});

test("server.port принимает целый порт, включая 0, и отклоняет ошибочную конфигурацию", () => {
  for (const port of [0, 1, 3001, 65535]) {
    assert.equal(configSchema.parse({ ...defaultConfig, server: { port } }).server.port, port);
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
