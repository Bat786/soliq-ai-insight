/**
 * Solana's web3.js touches Node's `Buffer` and `global` at module scope, which
 * are absent in the browser and throw before React can mount. Import this
 * module *first* in any file that pulls in Solana libraries — ESM evaluates
 * imports in source order, so the globals exist before web3.js runs.
 */
import { Buffer } from "buffer";

if (typeof globalThis !== "undefined") {
  const g = globalThis as Record<string, unknown> & { Buffer?: typeof Buffer };
  if (!g["Buffer"]) g["Buffer"] = Buffer;
  if (!g["global"]) g["global"] = globalThis;
  if (!g["process"]) g["process"] = { env: {} };
}


export {};
