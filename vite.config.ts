import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  // Expose every VITE_* variable (from the environment or .env files) as import.meta.env.*.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  return {
    define: envDefine,
    ...(command === "build" && mode === "development"
      ? {
          environments: {
            client: { define: { "process.env.NODE_ENV": JSON.stringify("development") } },
          },
          esbuild: { keepNames: true } as any,
        }
      : {}),
    plugins: [
      tailwindcss(),
      tanstackStart({
        // Server-only code must never end up in the browser bundle.
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
        // nitro/vite builds from this
        server: { entry: "server" },
        client: { entry: "client" },
      }),
      // Production server bundle. The Dockerfile sets NITRO_PRESET=node-server, which
      // emits a plain Node server at .output/server/index.mjs.
      ...(command === "build" ? [nitro()] : []),
      viteReact(),
    ],
    resolve: {
      // Vite's built-in tsconfig "paths" support (replaces the vite-tsconfig-paths plugin).
      tsconfigPaths: true,
      alias: {
        "@": `${process.cwd()}/src`,
        "#tanstack-router-entry": `${process.cwd()}/src/router.tsx`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      exclude: ["lucide-react", "@tanstack/react-start", "@tanstack/react-start-client"],
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-router",
        "@tanstack/react-query",
        "zustand",
        "zustand/middleware",
        "clsx",
        "tailwind-merge",
      ],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "::",
      port: 8080,
      // Wait for editors to finish writing before reloading.
      watch: { awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 } },
    },
  };
});
