import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: Object.fromEntries([
      ...["app", "compositions", "domains", "infra", "ui", "shared"].map((layer) => [
        layer,
        fileURLToPath(new URL(`./src/${layer}`, import.meta.url)),
      ]),
      [
        "#contracts",
        fileURLToPath(new URL("../../packages/contracts/src/index.ts", import.meta.url)),
      ],
    ]),
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [
        fileURLToPath(new URL("./", import.meta.url)),
        fileURLToPath(new URL("../../node_modules", import.meta.url)),
        fileURLToPath(new URL("../../packages/contracts", import.meta.url)),
      ],
    },
    proxy: { "/api": { target: process.env.TASKS_API_URL ?? "http://127.0.0.1:3000" } },
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
    target: "es2022",
    // Цветовая схема Mantine определяется во время выполнения; light-dark должен остаться нативным.
    cssTarget: ["chrome123", "firefox120", "safari17.5"],
  },
});
