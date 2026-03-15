import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,

  // Parser + type-aware linting options
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },

  // Project-specific rules
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",
    },
  },

  // Ignore generated, compiled, and test files
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src/data/thai-postal-code.data.ts",
    ],
  },
);