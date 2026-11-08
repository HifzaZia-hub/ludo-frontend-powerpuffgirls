import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// The rules of Ludo live in mock-server/. The client must never reach them (CLAUDE.md §1).
const NO_MOCK_SERVER = {
  group: ["**/mock-server", "**/mock-server/**", "mock-server", "mock-server/**"],
  message: "mock-server/ is a separate process. Talk to it through GameAdapter.",
};

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
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          // NFR-SYS-12: everything else reaches the server through GameAdapter.
          paths: [
            {
              name: "socket.io-client",
              message: "Only src/adapter/ may open a socket. Use the GameAdapter interface.",
            },
          ],
          patterns: [NO_MOCK_SERVER],
        },
      ],
    },
  },
  {
    // This block replaces the one above for the adapter folder, which is allowed a socket.
    files: ["src/adapter/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [NO_MOCK_SERVER] }],
    },
  },
  {
    // NFR-SYS-05: every dice value comes from the server, so nothing here may make one up.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "The server owns all randomness (NFR-SYS-05).",
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
