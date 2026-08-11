import { createServerFn } from "@tanstack/react-start";

export const getCryptoDesk = createServerFn({ method: "GET" }).handler(async () => {
  const { loadCryptoDesk } = await import("@/lib/dex.server");
  return loadCryptoDesk();
});

export const searchDexPairs = createServerFn({ method: "GET" })
  .inputValidator((input: { q: string }) => ({ q: String(input?.q ?? "").slice(0, 40) }))
  .handler(async ({ data }) => {
    const { searchPairs } = await import("@/lib/dex.server");
    return searchPairs(data.q);
  });
