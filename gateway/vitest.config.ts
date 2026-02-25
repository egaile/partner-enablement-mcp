import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    // Ensure ES module resolution mirrors tsconfig
    alias: [],
  },
});
