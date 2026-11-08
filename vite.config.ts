import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // fileURLToPath, not URL.pathname: our project path has a space and runs on Windows.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    // Testing Library only cleans up between tests when afterEach is global.
    globals: true,
    setupFiles: ["src/testSetup.ts"],
  },
});
