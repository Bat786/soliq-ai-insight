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
    // Solana libs reach for Node's `Buffer` at module scope. Let Vite pre-bundle
    // the pure-JS `buffer` package so its CJS exports get proper ESM interop —
    // hand-rolled aliasing to the raw CJS file breaks the default/named exports.
    optimizeDeps: { include: ["buffer"] },
  },
});


