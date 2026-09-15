import { cp } from "node:fs/promises";

// Сервер владеет поставкой UI; расположение одинаково в workspace и npm-архиве.
await cp(new URL("../../web/dist/", import.meta.url), new URL("../dist/web/", import.meta.url), {
  recursive: true,
});
