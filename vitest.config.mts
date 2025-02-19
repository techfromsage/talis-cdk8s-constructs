import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    deps: {
      interopDefault: true,
    },
    setupFiles: ["./test/setup.ts"],
    coverage: {
      exclude: [
        ...coverageConfigDefaults.exclude,
        "e2e/**",
        "examples/**",
        "imports/**",
        "*.config.mjs",
      ],
    },
  },
});
