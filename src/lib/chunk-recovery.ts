/**
 * Recovers from stale/failed dynamic chunk loads.
 *
 * When a deploy or a dev-server dependency re-optimization replaces the hashed
 * asset files, an in-flight `import()` for a route chunk fails with
 * "Importing a module script failed" / "Failed to fetch dynamically imported
 * module" and the app renders a blank screen. Reloading once fetches the fresh
 * manifest. A session flag prevents an infinite reload loop when the failure is
 * caused by something other than a stale chunk.
 */
const FLAG = "soliq:chunk-reloaded";

const CHUNK_ERROR_PATTERNS = [
  "importing a module script failed",
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "'text/html' is not a valid javascript mime type",
];

function isChunkError(message: unknown): boolean {
  if (typeof message !== "string") return false;
  const lower = message.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}

function recover(message: unknown): boolean {
  if (!isChunkError(message)) return false;
  try {
    if (sessionStorage.getItem(FLAG)) return false;
    sessionStorage.setItem(FLAG, "1");
  } catch {
    // sessionStorage unavailable (private mode) — reload anyway, once per page.
  }
  window.location.reload();
  return true;
}

export function installChunkRecovery() {
  if (typeof window === "undefined") return;
  if ((window as unknown as Record<string, boolean>)["__soliqChunkRecovery"]) return;
  (window as unknown as Record<string, boolean>)["__soliqChunkRecovery"] = true;

  // Clear the guard once the app has successfully booted.
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(FLAG);
    } catch {
      /* ignore */
    }
  }, 8000);

  window.addEventListener("error", (event) => {
    if (recover(event.message)) event.preventDefault();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      typeof reason === "string" ? reason : (reason as Error | undefined)?.message;
    if (recover(message)) event.preventDefault();
  });
}
