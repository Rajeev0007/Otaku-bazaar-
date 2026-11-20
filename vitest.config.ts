import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests share one database; run files sequentially.
    fileParallelism: false,
    setupFiles: ["tests/setup.ts"],
    testTimeout: 20000,
  },
});
