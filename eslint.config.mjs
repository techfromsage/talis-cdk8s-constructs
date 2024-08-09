import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      "**/coverage",
      "**/node_modules",
      "**/.vscode/",
      "imports/**/*.ts",
      "imports/**/*.d.ts",
      "imports/**/*.js",
      "examples/**/*.d.ts",
      "examples/**/*.js",
      "lib/**/*.d.ts",
      "lib/**/*.js",
      "test/**/*.d.ts",
      "test/**/*.js",
    ],
  },
  ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ),
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
      globals: {
        ...globals.node,
        afterAll: true,
        afterEach: true,
        beforeAll: true,
        beforeEach: true,
        describe: true,
        expect: true,
        test: true,
        vi: true,
      },

      parser: tsParser,
    },
  },
];
