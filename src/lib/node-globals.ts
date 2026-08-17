/**
 * Solana's web3.js touches Node's `Buffer` and `global` at module scope, which
 * are absent in the browser and throw before React can mount. Import this
 * module *first* in any file that pulls in Solana libraries — ESM evaluates
 * imports in source order, so the globals exist before web3.js runs.
 */
// Namespace import only: depending on how the bundler interops the CJS `buffer`
// package it may expose `Buffer` as a named export, on `default`, or both, and a
// named/default import of the wrong shape is a hard module-load error.
import * as bufferModule from "buffer";

const ns = bufferModule as unknown as { Buffer?: unknown; default?: { Buffer?: unknown } };
const Buffer = ns.Buffer ?? ns.default?.Buffer ?? ns.default;

if (typeof globalThis !== "undefined") {
  const g = globalThis as Record<string, unknown> & { Buffer?: unknown };
  if (!g["Buffer"]) g["Buffer"] = Buffer;
  if (!g["global"]) g["global"] = globalThis;
  if (!g["process"]) g["process"] = { env: {} };
}


export {};
