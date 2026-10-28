import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Standalone from vite.config.ts on purpose: that config pulls in the full
// TanStack Start/nitro SSR setup, none of which unit tests need -- this is just
// the @ alias + jsdom so component/hook/util tests can run fast in isolation.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // This is a monorepo-shaped layout: server/ has its own Jest suite.
    // Without this, Vitest's default include pattern also picks up
    // server/**/*.spec.ts, which uses Jest's `jest.fn()` global that Vitest
    // doesn't provide.
    exclude: ["**/node_modules/**", "server/**"],
  },
});
