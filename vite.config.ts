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

// In the *browser* build a bare `buffer` import is treated as a Node builtin and
// left out of the bundle, so `Buffer` ends up undefined and @solana/web3.js dies
// at module scope ("undefined is not an object (evaluating 'r.from')") which
// blanks any page that mounts the wallet adapter. Point the client build at the
// pure-JS npm package. Only the client — the SSR/worker environments have a real
// Buffer and must keep the builtin (aliasing there breaks the dev SSR runner).
const bufferShim = fileURLToPath(new URL("./node_modules/buffer/index.js", import.meta.url));

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
    environments: {
      client: {
        resolve: {
          alias: [
            { find: /^rpc-websockets$/, replacement: rpcWebsocketsBrowser },
            { find: /^(node:)?buffer$/, replacement: bufferShim },
          ],
        },
      },
    },
    // Solana libs reach for Node's `Buffer` at module scope. Let Vite pre-bundle
    // the pure-JS `buffer` package so its CJS exports get proper ESM interop.
    optimizeDeps: { include: ["buffer"] },
  },
});




