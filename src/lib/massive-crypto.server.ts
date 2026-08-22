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

import type { Bar } from "@/lib/futures.server";
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

/**
 * Meme words matched on WORD boundaries only. Substring matching produced false
 * positives (Moonwell/Moonbeam on "moon", SwiftCoin on "wif", Melon on "elon"),
 * so each candidate name is tokenized first.
 */
const MEME_WORDS = new Set([
  "doge", "dogecoin", "inu", "shiba", "shib", "pepe", "floki", "meme", "memecoin", "wojak", "chad", "gigachad",
  "frog", "wif", "dogwifhat", "bonk", "fart", "fartcoin", "hodl", "moon", "cat", "kitty", "elon", "trump",
  "pump", "ape", "wen", "andy", "brett", "popcat", "mog", "turbo", "pnut", "peanut", "goat", "banana", "chill",
]);

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const looksMeme = (symbol: string, name: string): boolean => {
  const words = tokenize(name);
  if (words.some((w) => MEME_WORDS.has(w))) return true;
  // Suffixed meme conventions: "…inu", "…doge", "…pepe", "…cat".
  if (words.some((w) => /(inu|doge|pepe)$/.test(w) && w.length > 3)) return true;
  return MEME_WORDS.has(symbol.toLowerCase());
};

const STABLE_PATTERN = /^(us[d]?[a-z0-9]{0,3}|eur[a-z0-9]{0,2})$/i;

/** Category for a base symbol + instrument name. Used by every crypto surface. */
export function classifyCryptoSymbol(symbol: string, name = ""): MassiveCryptoCategory {
  const s = symbol.toUpperCase();
  if (STABLES.has(s)) return "stablecoin";
  if (/\b(stable|pegged)\b/i.test(name)) return "stablecoin";
  // A "USD-ish" ticker with a dollar/euro instrument name is a fiat token.
  if (STABLE_PATTERN.test(s) && /(dollar|euro|usd|eur)/i.test(name) && !/index|future/i.test(name)) return "stablecoin";
  if (MEMES.has(s)) return "memecoin";
  if (looksMeme(s, name)) return "memecoin";
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
let refreshing: Promise<void> | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The USD-quoted Massive crypto universe with its latest daily session.
 *
 * A populated universe is cached for 10 minutes. An empty one is not: the
 * Massive per-minute allowance is shared with every other desk, so a cold
 * cache on a busy page can be throttled out. When that happens a single
 * background retry loop keeps trying across the next few minute windows and
 * the next poll of any desk picks up the filled universe.
 */
export async function loadMassiveCryptoUniverse(): Promise<MassiveCryptoUniverse> {
  const fresh = memo && Date.now() - memo.at < 600_000 && memo.value.priced > 0;
  if (fresh) return memo!.value;

  const built = await buildUniverse();
  if (built.priced > 0) return built;

  // Throttled or not answered yet — retry quietly in the background.
  if (!refreshing) {
    refreshing = (async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await sleep(20_000);
        const retry = await buildUniverse().catch(() => null);
        if (retry && retry.priced > 0) break;
      }
      refreshing = null;
    })();
  }
  return built;
}

async function buildUniverse(): Promise<MassiveCryptoUniverse> {
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
  const referencePromise = massiveGet<{ results?: RefTicker[]; count?: number }>(
    "/v3/reference/tickers?market=crypto&active=true&limit=1000",
    { ttl: 24 * 3600_000, scope: "reference:crypto-universe" },
  );
  const daysPromise = Promise.all(
    // Three sessions is enough for a 24h change plus a short trend, and keeps
    // this loader inside the Massive per-minute request allowance on a cold cache.
    [1, 2, 3].map((offset) => groupedDay("crypto", offset).catch(() => new Map<string, Bar>())),
  );
  const [reference, days] = await Promise.all([referencePromise, daysPromise]);

  const sessions = days.filter((d) => d.size > 0);
  if (sessions.length === 0) {
    notes.push("Massive crypto sessions are throttled right now — the tape fills in on the next refresh.");
  }

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
  if (identity.size === 0) notes.push("Massive crypto reference list not answered yet — retrying in the background.");

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
    let latest: Bar | null = null;
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
  if (priced > 0 || !memo) memo = { at: Date.now(), value };
  return priced > 0 ? value : (memo?.value ?? value);
}

/** Universe slice for one category. */
export async function loadMassiveCryptoByCategory(
  category: MassiveCryptoCategory,
): Promise<MassiveCryptoAsset[]> {
  const { assets } = await loadMassiveCryptoUniverse();
  return assets.filter((a) => a.category === category);
}
