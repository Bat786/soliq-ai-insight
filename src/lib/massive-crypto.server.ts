/**
 * Massive crypto universe ingestion — server only.
 *
 * Massive lists the whole crypto tape as `X:<BASE><QUOTE>` tickers. This module
 * turns that into SOLIQ's normalized asset rows, dynamically:
 *
 *   /v3/reference/tickers?market=crypto   → identity + names (cached 24h)
 *   /v2/aggs/grouped/.../crypto/{day}     → one call = every ticker's session
 *
 * Two cached requests cover the entire universe, which matters because the
 * Massive plan's per-minute budget is small and shared with every other desk.
 * Nothing here is hard-coded to a fixed count: new listings appear on their own.
 */

import { groupedDay, massiveConfigured, massiveGet } from "@/lib/massive.server";

export type MassiveCryptoCategory = "stablecoin" | "memecoin" | "crypto";

export type MassiveCryptoAsset = {
  /** SOLIQ id, e.g. `massive:BTC`. */
  id: string;
  /** Massive ticker, e.g. `X:BTCUSD`. */
  ticker: string;
  /** Base symbol, e.g. `BTC`. */
  symbol: string;
  name: string;
  category: MassiveCryptoCategory;
  quote: string;
  provider: "massive";
  price: number;
  prevClose: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  /** Trailing closes (newest last) assembled from the daily summaries. */
  series: number[];
  ts: number;
};

/* ----------------------------- classification ----------------------------- */

/** Fiat-pegged symbols. Extended by the pattern test below. */
const STABLES = new Set([
  "USDC", "USDT", "DAI", "PYUSD", "EURC", "TUSD", "USDP", "GUSD", "BUSD", "FDUSD", "USDE", "USDS",
  "LUSD", "USDD", "SUSD", "FRAX", "EURT", "EURS", "USTC", "USDG", "RLUSD", "USDY", "CUSD", "XSGD",
  "EURR", "AEUR", "USDB", "USD0", "DOLA", "MIM", "ALUSD", "CRVUSD", "GHO", "PAXG_USD",
]);

/** Known meme tickers; the regex below catches new ones. */
const MEMES = new Set([
  "DOGE", "SHIB", "PEPE", "BONK", "WIF", "FLOKI", "BOME", "MEW", "POPCAT", "BRETT", "SPX", "TRUMP",
  "FARTCOIN", "ELON", "MOG", "TURBO", "BABYDOGE", "PNUT", "GOAT", "WEN", "MYRO", "SLERF", "SAMO",
  "MICHI", "PONKE", "TOSHI", "SNEK", "DOGS", "NEIRO", "MOODENG", "CHILLGUY", "AKITA", "KISHU", "HOGE",
  "LADYS", "WOJAK", "BOBO", "BAN", "GIGA", "APU", "ANDY", "SIGMA", "DADDY",
]);

const MEME_PATTERN = /(doge|inu|shib|pepe|floki|meme|wojak|cat|kitty|frog|moon|elon|chad|wif|bonk|baby|fart|poop|trump|hodl)/i;
const STABLE_PATTERN = /^(us[d]?[a-z0-9]{0,3}|eur[a-z0-9]{0,2})$/i;

/** Category for a base symbol + instrument name. Used by every crypto surface. */
export function classifyCryptoSymbol(symbol: string, name = ""): MassiveCryptoCategory {
  const s = symbol.toUpperCase();
  const label = `${s} ${name}`;
  if (STABLES.has(s)) return "stablecoin";
  if (/\b(stable|pegged)\b/i.test(name)) return "stablecoin";
  // A "USD-ish" ticker with a dollar/euro instrument name is a fiat token.
  if (STABLE_PATTERN.test(s) && /(dollar|euro|usd|eur)/i.test(name) && !/index|future/i.test(name)) return "stablecoin";
  if (MEMES.has(s)) return "memecoin";
  if (MEME_PATTERN.test(label)) return "memecoin";
  return "crypto";
}

/* -------------------------------- ingestion -------------------------------- */

type RefTicker = {
  ticker?: string;
  name?: string;
  base_currency_symbol?: string;
  base_currency_name?: string;
  currency_symbol?: string;
  active?: boolean;
};

/** Split `X:BTCUSD` into its base and quote. */
export function splitCryptoTicker(ticker: string): { base: string; quote: string } | null {
  const body = ticker.replace(/^X:/, "").toUpperCase();
  if (!body) return null;
  for (const quote of ["USDT", "USDC", "USD", "EUR", "GBP", "JPY", "BTC", "ETH"]) {
    if (body.length > quote.length && body.endsWith(quote)) {
      return { base: body.slice(0, body.length - quote.length), quote };
    }
  }
  return null;
}

const cleanName = (raw: string, base: string): string => {
  const head = raw.split(" - ")[0]?.trim();
  return head && head.length > 0 ? head : base;
};

export type MassiveCryptoUniverse = {
  assets: MassiveCryptoAsset[];
  /** How many crypto tickers the reference endpoint listed. */
  listed: number;
  /** How many of those had a session price we could attach. */
  priced: number;
  notes: string[];
  updatedAt: number;
};

let memo: { at: number; value: MassiveCryptoUniverse } | null = null;

/**
 * The USD-quoted Massive crypto universe with its latest daily session.
 * Cached for 10 minutes on top of the client's own caches.
 */
export async function loadMassiveCryptoUniverse(): Promise<MassiveCryptoUniverse> {
  if (memo && Date.now() - memo.at < 600_000) return memo.value;
  const notes: string[] = [];
  if (!massiveConfigured()) {
    const empty: MassiveCryptoUniverse = {
      assets: [],
      listed: 0,
      priced: 0,
      notes: ["MASSIVE_API_KEY missing — Massive crypto universe unavailable"],
      updatedAt: Date.now(),
    };
    return empty;
  }

  // Identity (one cached call) + the last few closed sessions (one cached call
  // each, and they never change once the day is closed).
  const [reference, ...days] = await Promise.all([
    massiveGet<{ results?: RefTicker[]; count?: number }>(
      "/v3/reference/tickers?market=crypto&active=true&limit=1000",
      { ttl: 24 * 3600_000, scope: "reference:crypto-universe" },
    ),
    ...[1, 2, 3, 4, 5].map((offset) => groupedDay("crypto", offset).catch(() => new Map())),
  ]);

  const sessions = days.filter((d) => d.size > 0);
  if (sessions.length === 0) notes.push("No closed Massive crypto session answered yet — prices will fill in shortly.");

  const identity = new Map<string, { name: string; base: string; quote: string }>();
  for (const r of reference?.results ?? []) {
    const ticker = String(r.ticker ?? "").toUpperCase();
    const parts = splitCryptoTicker(ticker);
    if (!ticker || !parts) continue;
    identity.set(ticker, {
      name: cleanName(String(r.base_currency_name ?? r.name ?? parts.base), parts.base),
      base: parts.base,
      quote: parts.quote,
    });
  }
  if (identity.size === 0) notes.push("Massive crypto reference list unavailable on the current plan.");

  // Any ticker present in a session but absent from the reference list still
  // counts — the tape is the source of truth for what is actually trading.
  for (const day of sessions) {
    for (const ticker of day.keys()) {
      if (identity.has(ticker)) continue;
      const parts = splitCryptoTicker(ticker);
      if (parts) identity.set(ticker, { name: parts.base, base: parts.base, quote: parts.quote });
    }
  }

  const assets: MassiveCryptoAsset[] = [];
  let priced = 0;
  for (const [ticker, meta] of identity) {
    // The dashboards are USD-denominated; other quotes stay out to avoid
    // duplicate rows for the same asset.
    if (meta.quote !== "USD") continue;

    // Newest session first, so `series` ends on the latest close.
    const closes: number[] = [];
    let latest: { close: number; high: number; low: number; volume: number; t: number } | null = null;
    for (let i = sessions.length - 1; i >= 0; i--) {
      const bar = sessions[i]?.get(ticker);
      if (!bar) continue;
      closes.push(bar.close);
      if (i === 0 || latest === null) latest = bar;
    }
    const last = sessions[0]?.get(ticker) ?? null;
    const use = last ?? latest;
    if (!use || !(use.close > 0)) continue;
    priced += 1;

    const prevClose = closes.length > 1 ? (closes[closes.length - 2] as number) : use.open || use.close;
    assets.push({
      id: `massive:${meta.base}`,
      ticker,
      symbol: meta.base,
      name: meta.name,
      category: classifyCryptoSymbol(meta.base, meta.name),
      quote: meta.quote,
      provider: "massive",
      price: use.close,
      prevClose,
      change24h: prevClose > 0 ? ((use.close - prevClose) / prevClose) * 100 : 0,
      volume24h: use.volume,
      high24h: use.high,
      low24h: use.low,
      series: closes,
      ts: use.t,
    });
  }

  assets.sort((a, b) => b.volume24h - a.volume24h);
  const value: MassiveCryptoUniverse = {
    assets,
    listed: identity.size,
    priced,
    notes,
    updatedAt: Date.now(),
  };
  memo = { at: Date.now(), value };
  return value;
}

/** Universe slice for one category. */
export async function loadMassiveCryptoByCategory(
  category: MassiveCryptoCategory,
): Promise<MassiveCryptoAsset[]> {
  const { assets } = await loadMassiveCryptoUniverse();
  return assets.filter((a) => a.category === category);
}
