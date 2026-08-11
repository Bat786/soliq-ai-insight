/** Solana / DEX crypto intelligence: Jupiter token feed + DexScreener metas & profiles. */

export type TokenStats = {
  priceChange: number;
  buyVolume: number;
  sellVolume: number;
  numBuys: number;
  numSells: number;
  numTraders: number;
  numNetBuyers: number;
  liquidityChange: number;
};

export type DexTf = "5m" | "1h" | "6h" | "24h";

export type TokenSignal = {
  tf: DexTf;
  bull: number;
  bear: number;
  tilt: number;
  label: string;
  confidence: number;
  changePct: number;
  volume: number;
};

export type TokenRow = {
  mint: string;
  symbol: string;
  name: string;
  icon: string | null;
  price: number;
  mcap: number;
  fdv: number;
  liquidity: number;
  holders: number;
  organicScore: number;
  organicLabel: string;
  verified: boolean;
  createdAt: number;
  buyPressure: number;
  netBuyers: number;
  volume24h: number;
  changePct: number;
  signals: TokenSignal[];
  verdict: "buy" | "sell" | "hold";
  score: number;
  audit: { mintDisabled: boolean; freezeDisabled: boolean; topHoldersPct: number };
};

export type TrendingMeta = {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  marketCap: number;
  liquidity: number;
  volume: number;
  tokenCount: number;
  change24h: number;
  change1h: number;
};

export type TokenProfile = {
  chainId: string;
  tokenAddress: string;
  url: string;
  icon: string | null;
  header: string | null;
  description: string | null;
  links: { label: string; url: string }[];
};

export type CryptoDesk = {
  movers: TokenRow[];
  fresh: TokenRow[];
  metas: TrendingMeta[];
  profiles: TokenProfile[];
  updatedAt: number;
  notes: string[];
};

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/* ---------------- caching ---------------- */

type Entry = { at: number; value: unknown };
const cache = new Map<string, Entry>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  try {
    const value = await load();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    if (hit) return hit.value as T;
    throw err;
  }
}

async function jupFetch(path: string): Promise<unknown> {
  const key = process.env["JUPITER_API_KEY"];
  const res = await fetch(`https://api.jup.ag${path}`, {
    headers: {
      Accept: "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Jupiter ${res.status}`);
  return res.json();
}

async function dexFetch(path: string): Promise<unknown> {
  const res = await fetch(`https://api.dexscreener.com${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`DexScreener ${res.status}`);
  return res.json();
}

/* ---------------- signal math ---------------- */

function stats(raw: unknown): TokenStats {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    priceChange: num(s["priceChange"]),
    buyVolume: num(s["buyVolume"]),
    sellVolume: num(s["sellVolume"]),
    numBuys: num(s["numBuys"]),
    numSells: num(s["numSells"]),
    numTraders: num(s["numTraders"]),
    numNetBuyers: num(s["numNetBuyers"]),
    liquidityChange: num(s["liquidityChange"]),
  };
}

function signal(tf: DexTf, s: TokenStats): TokenSignal {
  const flow = s.buyVolume + s.sellVolume;
  const flowTilt = flow > 0 ? (s.buyVolume - s.sellVolume) / flow : 0;
  const orderTilt =
    s.numBuys + s.numSells > 0 ? (s.numBuys - s.numSells) / (s.numBuys + s.numSells) : 0;
  const momentum = Math.max(-1, Math.min(1, s.priceChange / 12));
  const liq = Math.max(-1, Math.min(1, s.liquidityChange / 15));
  const tilt = Math.max(-1, Math.min(1, flowTilt * 0.4 + orderTilt * 0.25 + momentum * 0.25 + liq * 0.1));
  const bull = Math.round(50 + tilt * 50);
  const label =
    tilt > 0.35 ? "Aggressive accumulation"
    : tilt > 0.12 ? "Buyers in control"
    : tilt < -0.35 ? "Heavy distribution"
    : tilt < -0.12 ? "Sellers in control"
    : "Balanced tape";
  const confidence = Math.max(
    12,
    Math.min(96, Math.round(Math.abs(tilt) * 70 + Math.min(30, Math.log10(1 + flow) * 6))),
  );
  return {
    tf,
    bull,
    bear: 100 - bull,
    tilt,
    label,
    confidence,
    changePct: s.priceChange,
    volume: flow,
  };
}

function toRow(raw: unknown): TokenRow | null {
  const t = (raw ?? {}) as Record<string, unknown>;
  const mint = typeof t["id"] === "string" ? t["id"] : "";
  if (!mint) return null;
  const tfs: DexTf[] = ["5m", "1h", "6h", "24h"];
  const map: Record<DexTf, TokenStats> = {
    "5m": stats(t["stats5m"]),
    "1h": stats(t["stats1h"]),
    "6h": stats(t["stats6h"]),
    "24h": stats(t["stats24h"]),
  };
  const signals = tfs.map((tf) => signal(tf, map[tf]));
  const d = map["24h"];
  const flow = d.buyVolume + d.sellVolume;
  const audit = (t["audit"] ?? {}) as Record<string, unknown>;

  const weights: Record<DexTf, number> = { "5m": 0.15, "1h": 0.3, "6h": 0.3, "24h": 0.25 };
  const blended = signals.reduce((acc, s) => acc + s.tilt * weights[s.tf], 0);
  const organic = num(t["organicScore"]);
  const score = Math.max(2, Math.min(98, Math.round(50 + blended * 45 + (organic - 50) * 0.12)));

  return {
    mint,
    symbol: String(t["symbol"] ?? "—").slice(0, 14),
    name: String(t["name"] ?? "Unknown"),
    icon: typeof t["icon"] === "string" ? t["icon"] : null,
    price: num(t["usdPrice"]),
    mcap: num(t["mcap"]),
    fdv: num(t["fdv"]),
    liquidity: num(t["liquidity"]),
    holders: num(t["holderCount"]),
    organicScore: organic,
    organicLabel: String(t["organicScoreLabel"] ?? "unknown"),
    verified: t["isVerified"] === true,
    createdAt: Date.parse(String(t["createdAt"] ?? "")) || 0,
    buyPressure: flow > 0 ? (d.buyVolume / flow) * 100 : 50,
    netBuyers: d.numNetBuyers,
    volume24h: flow,
    changePct: d.priceChange,
    signals,
    verdict: score >= 62 ? "buy" : score <= 38 ? "sell" : "hold",
    score,
    audit: {
      mintDisabled: audit["mintAuthorityDisabled"] === true,
      freezeDisabled: audit["freezeAuthorityDisabled"] === true,
      topHoldersPct: num(audit["topHoldersPercentage"]),
    },
  };
}

function rows(raw: unknown): TokenRow[] {
  return Array.isArray(raw) ? raw.map(toRow).filter((r): r is TokenRow => r !== null) : [];
}

/* ---------------- loaders ---------------- */

export async function loadCryptoDesk(): Promise<CryptoDesk> {
  const notes: string[] = [];

  const [movers, fresh, metas, profiles] = await Promise.all([
    cached("jup:top", 45_000, () => jupFetch("/tokens/v2/toporganicscore/24h?limit=30").then(rows)).catch((e) => {
      notes.push(`Jupiter movers unavailable (${(e as Error).message})`);
      return [] as TokenRow[];
    }),
    cached("jup:recent", 45_000, () => jupFetch("/tokens/v2/recent?limit=24").then(rows)).catch((e) => {
      notes.push(`Jupiter launches unavailable (${(e as Error).message})`);
      return [] as TokenRow[];
    }),
    cached("dex:metas", 120_000, () => dexFetch("/metas/trending/v1").then(toMetas)).catch((e) => {
      notes.push(`DexScreener metas unavailable (${(e as Error).message})`);
      return [] as TrendingMeta[];
    }),
    cached("dex:profiles", 120_000, () =>
      dexFetch("/token-profiles/latest/v1").then(toProfiles),
    ).catch((e) => {
      notes.push(`DexScreener profiles unavailable (${(e as Error).message})`);
      return [] as TokenProfile[];
    }),
  ]);

  return { movers, fresh, metas, profiles, updatedAt: Date.now(), notes };
}

function toMetas(raw: unknown): TrendingMeta[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 18).map((r) => {
    const m = (r ?? {}) as Record<string, unknown>;
    const chg = (m["marketCapChange"] ?? {}) as Record<string, unknown>;
    const icon = (m["icon"] ?? {}) as Record<string, unknown>;
    return {
      slug: String(m["slug"] ?? ""),
      name: String(m["name"] ?? ""),
      description: String(m["description"] ?? ""),
      emoji: String(icon["value"] ?? "✦"),
      marketCap: num(m["marketCap"]),
      liquidity: num(m["liquidity"]),
      volume: num(m["volume"]),
      tokenCount: num(m["tokenCount"]),
      change24h: num(chg["h24"]),
      change1h: num(chg["h1"]),
    };
  });
}

function toProfiles(raw: unknown): TokenProfile[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 18).map((r) => {
    const p = (r ?? {}) as Record<string, unknown>;
    const links = Array.isArray(p["links"]) ? (p["links"] as Record<string, unknown>[]) : [];
    return {
      chainId: String(p["chainId"] ?? ""),
      tokenAddress: String(p["tokenAddress"] ?? ""),
      url: String(p["url"] ?? ""),
      icon: typeof p["icon"] === "string" ? p["icon"] : null,
      header: typeof p["header"] === "string" ? p["header"] : null,
      description: typeof p["description"] === "string" ? p["description"] : null,
      links: links
        .filter((l) => typeof l["url"] === "string")
        .slice(0, 4)
        .map((l) => ({
          label: String(l["label"] ?? l["type"] ?? "link"),
          url: String(l["url"]),
        })),
    };
  });
}

/* ---------------- pair search / detail ---------------- */

export type DexPair = {
  pairAddress: string;
  chainId: string;
  dexId: string;
  url: string;
  symbol: string;
  name: string;
  quote: string;
  priceUsd: number;
  liquidity: number;
  fdv: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  change1h: number;
  buys24h: number;
  sells24h: number;
  createdAt: number;
  icon: string | null;
};

function toPair(raw: unknown): DexPair | null {
  const p = (raw ?? {}) as Record<string, unknown>;
  const base = (p["baseToken"] ?? {}) as Record<string, unknown>;
  const quote = (p["quoteToken"] ?? {}) as Record<string, unknown>;
  const vol = (p["volume"] ?? {}) as Record<string, unknown>;
  const chg = (p["priceChange"] ?? {}) as Record<string, unknown>;
  const liq = (p["liquidity"] ?? {}) as Record<string, unknown>;
  const txns = (p["txns"] ?? {}) as Record<string, unknown>;
  const h24 = (txns["h24"] ?? {}) as Record<string, unknown>;
  const info = (p["info"] ?? {}) as Record<string, unknown>;
  const addr = typeof p["pairAddress"] === "string" ? p["pairAddress"] : "";
  if (!addr) return null;
  return {
    pairAddress: addr,
    chainId: String(p["chainId"] ?? ""),
    dexId: String(p["dexId"] ?? ""),
    url: String(p["url"] ?? ""),
    symbol: String(base["symbol"] ?? "—"),
    name: String(base["name"] ?? ""),
    quote: String(quote["symbol"] ?? ""),
    priceUsd: Number(p["priceUsd"] ?? 0) || 0,
    liquidity: num(liq["usd"]),
    fdv: num(p["fdv"]),
    marketCap: num(p["marketCap"]),
    volume24h: num(vol["h24"]),
    change24h: num(chg["h24"]),
    change1h: num(chg["h1"]),
    buys24h: num(h24["buys"]),
    sells24h: num(h24["sells"]),
    createdAt: num(p["pairCreatedAt"]),
    icon: typeof info["imageUrl"] === "string" ? info["imageUrl"] : null,
  };
}

export async function searchPairs(query: string): Promise<DexPair[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const raw = await cached(`dex:search:${q.toLowerCase()}`, 30_000, () =>
    dexFetch(`/latest/dex/search?q=${encodeURIComponent(q)}`),
  );
  const list = ((raw ?? {}) as Record<string, unknown>)["pairs"];
  const pairs = Array.isArray(list) ? list.map(toPair).filter((p): p is DexPair => p !== null) : [];
  return pairs.sort((a, b) => b.liquidity - a.liquidity).slice(0, 20);
}
