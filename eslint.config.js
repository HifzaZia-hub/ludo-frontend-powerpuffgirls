import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // The rules of Ludo live in mock-server/. The client must never reach them (CLAUDE.md §1).
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/mock-server", "**/mock-server/**", "mock-server", "mock-server/**"],
              message: "mock-server/ is a separate process. Talk to it through GameAdapter.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["mock-server/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
);
