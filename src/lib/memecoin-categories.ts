/**
 * Memecoin niche taxonomy (client-safe).
 *
 * Categories are derived from data SOLIQ already fetches — token symbol, name,
 * age, liquidity and flow — so classification costs no extra provider requests.
 * Nothing here invents a narrative: a token that matches no niche stays "other".
 */

export type MemeCategory =
  | "ai"
  | "gaming"
  | "defi"
  | "solana"
  | "animals"
  | "political"
  | "community"
  | "new"
  | "other";

export const memeCategoryLabels: Record<MemeCategory, string> = {
  ai: "AI",
  gaming: "Gaming",
  defi: "DeFi",
  solana: "Solana ecosystem",
  animals: "Animals",
  political: "Political",
  community: "Community",
  new: "New launches",
  other: "Other",
};

const WORDS: Partial<Record<MemeCategory, string[]>> = {
  ai: ["ai", "agent", "agents", "gpt", "neural", "robot", "bot", "brain", "llm", "machine", "intelligence", "singularity"],
  gaming: ["game", "gaming", "play", "arcade", "quest", "pixel", "metaverse", "guild", "rpg", "nft"],
  defi: ["defi", "swap", "dex", "yield", "stake", "staking", "vault", "lend", "lending", "perp", "perps", "liquidity", "farm"],
  solana: ["sol", "solana", "saga", "bonk", "jup", "jupiter", "pump", "raydium", "phantom", "sága"],
  animals: [
    "dog", "doge", "inu", "shiba", "shib", "cat", "kitty", "kitten", "puppy", "frog", "pepe", "monkey", "ape",
    "bear", "bull", "hippo", "moodeng", "penguin", "duck", "goat", "wolf", "fox", "bird", "owl", "whale",
    "hamster", "rat", "snek", "snake", "turtle", "panda", "koala", "lion", "tiger",
  ],
  political: ["trump", "biden", "maga", "kamala", "election", "president", "politic", "senate", "vote", "boden"],
  community: ["dao", "community", "family", "army", "friends", "fam", "holders", "cult", "gang", "club"],
};

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Order matters: the first match wins, so specific niches come before broad ones. */
const ORDER: MemeCategory[] = ["ai", "gaming", "defi", "political", "animals", "community", "solana"];

export type CategorizableToken = {
  symbol: string;
  name: string;
  /** Mint/pair creation timestamp in ms, when known. */
  createdAt?: number;
};

const NEW_LAUNCH_MS = 72 * 60 * 60 * 1000;

/** Classify one token into a memecoin niche using only data we already hold. */
export function categorizeToken(token: CategorizableToken): MemeCategory {
  if (token.createdAt && Date.now() - token.createdAt < NEW_LAUNCH_MS) return "new";
  const words = new Set([...tokenize(token.name), ...tokenize(token.symbol)]);
  for (const category of ORDER) {
    const list = WORDS[category];
    if (!list) continue;
    if (list.some((w) => words.has(w))) return category;
  }
  return "other";
}

/** Categories present in a set of tokens, in display order, with counts. */
export function categoryCounts(tokens: CategorizableToken[]): { id: MemeCategory; count: number }[] {
  const counts = new Map<MemeCategory, number>();
  for (const t of tokens) {
    const c = categorizeToken(t);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const display: MemeCategory[] = [...ORDER, "new", "other"];
  return display.filter((id) => counts.has(id)).map((id) => ({ id, count: counts.get(id) ?? 0 }));
}
