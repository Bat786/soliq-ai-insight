import { createServerFn } from "@tanstack/react-start";

const deskIds = ["fx", "futures", "stocks", "crypto", "indices"] as const;
const intervals = ["1m", "5m", "15m", "1h"] as const;

export const getTapeBoard = createServerFn({ method: "GET" })
  .inputValidator((input: { desk?: (typeof deskIds)[number] | undefined } | undefined) => ({
    desk: (input?.desk && deskIds.includes(input.desk) ? input.desk : undefined) as
      | (typeof deskIds)[number]
      | undefined,
  }))
  .handler(async ({ data }) => {
    const { loadTapeBoard } = await import("@/lib/tape.server");
    return loadTapeBoard(data.desk);
  });

export const getTapeDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { key: string; interval: (typeof intervals)[number] }) => ({
    key: String(input.key ?? "").slice(0, 20),
    interval: intervals.includes(input.interval) ? input.interval : "5m",
  }))
  .handler(async ({ data }) => {
    const { loadTapeDetail } = await import("@/lib/tape.server");
    return loadTapeDetail(data.key, data.interval);
  });

export const searchTape = createServerFn({ method: "GET" })
  .inputValidator((input: { q: string }) => ({ q: String(input.q ?? "").slice(0, 40) }))
  .handler(async ({ data }) => {
    const { searchSymbols } = await import("@/lib/tape.server");
    return searchSymbols(data.q);
  });
