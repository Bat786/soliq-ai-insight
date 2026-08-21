// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

// Server routes (email, webhooks) read non-VITE_ secrets from process.env.
// Client env injection is handled by @lovable.dev/vite-tanstack-config.
Object.assign(process.env, loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), ""));

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
const eventEmitterShim = fileURLToPath(new URL("./node_modules/eventemitter3/index.mjs", import.meta.url));

/** Resolves `buffer` to the pure-JS package in the browser build only. */
const clientBufferShim = {
  name: "soliq-client-buffer-shim",
  enforce: "pre" as const,
  // Dev relies on Vite's dep optimizer (which handles the CJS interop); only the
  // production build needs the explicit redirect.
  apply: "build" as const,
  applyToEnvironment: (env: { name: string }) => env.name === "client",
  resolveId(id: string) {
    if (id === "buffer" || id === "node:buffer") return bufferShim;
    if (id === "eventemitter3") return eventEmitterShim;
    return null;
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [clientBufferShim],
    resolve: {
      alias: [
        { find: /^rpc-websockets$/, replacement: rpcWebsocketsBrowser },
        { find: /^eventemitter3$/, replacement: eventEmitterShim },
        // Force the hoisted entities@4.5.0 copy; nested v7 drops ./lib/decode.js and breaks SSR.
        { find: "entities/lib/decode.js", replacement: path.resolve(projectRoot, "node_modules/entities/lib/decode.js") },
        { find: "entities/lib/encode.js", replacement: path.resolve(projectRoot, "node_modules/entities/lib/encode.js") },
        { find: /^entities$/, replacement: path.resolve(projectRoot, "node_modules/entities") },
      ],
    },
    // Solana libs reach for Node's `Buffer` at module scope. Let Vite pre-bundle
    // the pure-JS `buffer` package so its CJS exports get proper ESM interop.
    optimizeDeps: { include: ["buffer", "eventemitter3"] },
  },
});





