/**
 * SOLIQ demo mode.
 *
 * Demo mode lets a visitor walk the real terminal without an account. Live
 * market data stays live; anything that would normally require a connected
 * account (portfolio, wallets, brokerage) is clearly labelled DEMO DATA.
 */

import { useEffect, useState } from "react";

const KEY = "soliq.demo";

export function isDemoActive(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(KEY) === "1";
}

export function enableDemo(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, "1");
  window.dispatchEvent(new Event("soliq:demo"));
}

export function disableDemo(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event("soliq:demo"));
}

/** Reactive demo flag — false during SSR and first paint, hydrated after mount. */
export function useDemoMode(): boolean {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    const sync = () => setDemo(isDemoActive());
    sync();
    window.addEventListener("soliq:demo", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("soliq:demo", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return demo;
}
