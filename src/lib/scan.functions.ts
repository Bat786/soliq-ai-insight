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
    return loadMarketScan(data);
  });

export const getCryptoScan = createServerFn({ method: "GET" }).handler(async () => {
  const { loadCryptoScan } = await import("@/lib/scan.server");
  return loadCryptoScan();
});
