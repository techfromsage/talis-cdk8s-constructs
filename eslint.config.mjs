import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-config-prettier";
import globals from "globals";

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
  js.configs.recommended,
  ...typescriptEslint.configs["flat/recommended"],
  prettier,
  {
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
    },
  },
];
