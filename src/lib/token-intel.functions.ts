import { createServerFn } from "@tanstack/react-start";

import type { TokenIntelTf } from "@/lib/token-intel.server";

const TFS: TokenIntelTf[] = ["5m", "15m", "1h", "4h", "1d"];

export const getTokenIntel = createServerFn({ method: "POST" })
  .inputValidator((input: { mint: string; timeframe?: string }) => ({
    mint: String(input.mint).slice(0, 80),
    timeframe: (TFS.includes(input.timeframe as TokenIntelTf) ? input.timeframe : "1h") as TokenIntelTf,
  }))
  .handler(async ({ data }) => {
    const { loadTokenIntel } = await import("@/lib/token-intel.server");
    return loadTokenIntel(data.mint, data.timeframe);
  });
