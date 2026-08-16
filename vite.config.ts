// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { fileURLToPath } from "node:url";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// `rpc-websockets` (pulled in by @solana/web3.js via the wallet adapter) only declares
// "browser" and "node" export conditions, so the worker build can't resolve it. Point it
// straight at the browser bundle, which uses the standard WebSocket global.
const rpcWebsocketsBrowser = fileURLToPath(
  new URL("./node_modules/rpc-websockets/dist/index.browser.mjs", import.meta.url),
);

// Solana libs reach for Node's `Buffer` at module scope. Only the browser needs
// the pure-JS polyfill — on the server the real Node builtin must win, otherwise
// the CJS polyfill gets evaluated during SSR and throws on `require`.
const bufferPolyfill = fileURLToPath(new URL("./node_modules/buffer/index.js", import.meta.url));

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: [{ find: /^rpc-websockets$/, replacement: rpcWebsocketsBrowser }],
    },
    plugins: [
      {
        name: "soliq-buffer-browser-only",
        enforce: "pre" as const,
        applyToEnvironment: (env: { name: string }) => env.name === "client",
        resolveId(id: string) {
          return id === "buffer" || id === "node:buffer" ? bufferPolyfill : null;
        },
      },
    ],
  },
});


