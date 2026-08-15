import { createServerFn } from "@tanstack/react-start";
import { deskIds, tapeIntervals, type TapeDeskId, type TapeInterval } from "@/lib/tape-desks";

export const getTapeBoard = createServerFn({ method: "GET" })
  .inputValidator((input: { desk?: TapeDeskId | undefined } | undefined) => ({
    desk: (input?.desk && deskIds.includes(input.desk) ? input.desk : undefined) as
      | TapeDeskId
      | undefined,
  }))
  .handler(async ({ data }) => {
    const { loadTapeBoard } = await import("@/lib/tape.server");
    return loadTapeBoard(data.desk);
  });

export const getTapeDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { key: string; interval: TapeInterval }) => ({
    key: String(input.key ?? "").slice(0, 20),
    interval: (tapeIntervals.includes(input.interval) ? input.interval : "5m") as TapeInterval,
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
