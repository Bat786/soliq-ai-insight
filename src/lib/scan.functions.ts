import { createServerFn } from "@tanstack/react-start";

import type { ScanFiltersInput } from "@/lib/scan.server";

export const getMarketScan = createServerFn({ method: "GET" })
  .inputValidator((input: ScanFiltersInput | undefined) => ({
    minPrice: Number(input?.minPrice ?? 1),
    minVolume: Number(input?.minVolume ?? 100_000),
    minChangePct: Number(input?.minChangePct ?? 0),
    topN: Number(input?.topN ?? 20),
    ...(input?.maxPrice === undefined ? {} : { maxPrice: Number(input.maxPrice) }),
  }))

  .handler(async ({ data }) => {
    const { loadMarketScan } = await import("@/lib/scan.server");
    const scan = await loadMarketScan(data);
    // Snapshot the scan for history, alerting and realtime subscribers. Never
    // let a persistence hiccup block the desk.
    if (scan.gainers.length + scan.losers.length + scan.highVolume.length > 0) {
      const { saveMarketScan } = await import("@/engines/core/repo.server");
      await saveMarketScan(scan).catch(() => undefined);
    }
    return scan;
  });

export const getCryptoScan = createServerFn({ method: "GET" }).handler(async () => {
  const { loadCryptoScan } = await import("@/lib/scan.server");
  return loadCryptoScan();
});
