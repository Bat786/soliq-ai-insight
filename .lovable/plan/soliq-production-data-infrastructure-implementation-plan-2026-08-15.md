# SOLIQ Production Data Infrastructure — Implementation Plan

## What exists today (audit result)

**Providers already wired, server-side only (keys never in browser):**
Massive/Polygon (`massive.server.ts`, `polygon.server.ts`, `equity.server.ts`), Unusual Whales (`unusual-whales.server.ts`), Jupiter + DexScreener (`dex.server.ts`), Yahoo/Frankfurter keyless tape (`tape.server.ts`), Alchemy + Solana RPC (`wallets.server.ts`, `wallet-activity.server.ts`), Lovable AI (`ai.server.ts`).
Keys in use: MASSIVE/POLYGON, UNUSUAL_WHALES, JUPITER, ALCHEMY, LOVABLE.

**Server functions (15 files):** ai, dex, equity, futures, live-market, news, polygon, profile, scan, soliq, symbol, tape, unusual-whales, wallet-activity, wallets.

**Screens:** home, scanner, stocks, crypto, futures, whales, symbol terminal, portfolio, lists, discover, community, assistant, wallets, backtest, settings, pricing, auth.

**Database (only 5 tables):** profiles, notifications, watchlist_alerts, community_posts, linked_wallets. Everything else in your PROMPT 10 list is missing.

**Real gaps found:** duplicated bar/quote/resample logic across tape/massive/polygon/futures/symbol; no shared normalized Asset/Quote/Candle model; no per-slice source+timestamp+staleness metadata reaching the UI; no caching layer shared between providers (each file re-implements its own); Solana wallet flow still uses legacy adapter behavior; no brokerage layer; community is a thin posts table.

## Approach

Refactor around four engines without deleting working code. Each engine is a service directory; existing `*.server.ts` files become provider **adapters** underneath it, so no integration is lost.

```text
src/engines/
  market/     quotes, candles, sessions, symbols  <- massive, polygon, tape, dex, futures
  flow/       options flow, dark pool, short int  <- unusual-whales, equity
  intel/      scoring, signals, scanner, AETHRON  <- ai, indicators, scan
  community/  posts, profiles, reputation
  core/       Asset|Quote|Candle|Trade|MarketEvent types, cache, rate-limit, retry, fallback, DataEnvelope
```

`DataEnvelope<T>` is the contract every engine returns and every component renders:
`{ data, source, fetchedAt, ageMs, state: "live"|"delayed"|"stale"|"loading"|"error"|"unavailable" }`.
No mock fallbacks anywhere — `unavailable` is a first-class rendered state.

## Phases

**Phase 1 — Core + Market Engine (foundation)**
Normalized schema + `DataEnvelope`; one shared cache/rate-limiter/retry/fallback used by all adapters; migrate market reads behind `engines/market`; add a `<DataState>` UI primitive (source badge, timestamp, stale/unavailable/error) and adopt it on symbol terminal, markets board, scanner. Add DexScreener/Jupiter/Pump.fun adapters for memecoin discovery.

**Phase 2 — Supabase schema**
Migrations for the PROMPT 10 tables in dependency order, with GRANTs + RLS in the same migration: market data read-only to all, user-owned rows scoped to `auth.uid()`, community public-read/owner-write. Indexes on ticker, ts, user_id, wallet_address. Realtime on alerts, community, scanner_results.

**Phase 3 — Professional Scanner**
Session modes (premarket/regular/after-hours/overnight/crypto 24-7), asset-type tabs, the ~28 named scans, composable filter builder (price, mcap, float, RVOL, premarket %, short interest, news catalyst), persisted presets. SOLIQ Opportunity Score with a visible per-factor reason list and an explicit "not a prediction" disclosure; factors with no data are excluded, never guessed.

**Phase 4 — SOLIQ FLOW**
Dedicated section preserving current Unusual Whales market-tide/flow/dark-pool/net-impact, extended with sweeps, blocks, OI, premium splits, dark-pool aggregation, 13F/institutional, insider, short interest/DTC/float/short%float. Integrated Flow Score. Unified asset flow page merging price action + options + dark pool + short interest + institutional.

**Phase 5 — Wallets (mobile-first rebuild)**
Wallet Standard discovery (Phantom, Solflare, Backpack) with an in-app selector; iOS/Android deep-link + universal-link connect that opens the installed app instead of a download page; persisted session, cluster selector, connection-status UI, holdings + transactions + P&L. Connection strictly separated from signing; signing path is build → simulate → review → approve → submit → confirm → refresh. No seed phrases or private keys, ever.

**Phase 6 — Brokerage aggregation**
`broker_connections/accounts/positions/transactions` + SnapTrade hosted-OAuth flow (Plaid Investments kept as a second adapter slot). Only provider IDs and normalized metadata stored, never passwords. Read-only vs trading-enabled clearly labeled; trades require explicit confirmation. Requires a SnapTrade key from you.

**Phase 7 — Community**
Trader network, not a generic feed: live market feed, trending tickers, breaking news, ideas, charts, trade setups, polls, research/education posts. `$TICKER` mentions become live market entities with attachable price/chart/indicators/score/flow/dark pool/short interest/news. Trader profiles + rankings; performance shown only where SOLIQ can verify it.

**Phase 8 — AETHRON**
Retrieval-first: every market question pulls current normalized engine data before reasoning, and answers carry source + timestamp. Output modes: briefings, asset analysis, scanner/signal explanations, portfolio insights, news summaries, risk analysis, research reports, education. Prices, news, holdings and events come only from retrieved data.

**Phase 9 — Design system pass**
Dark-first institutional terminal language (Bloomberg/TradingView density, Apple/Robinhood polish) applied to the existing routes, with reusable ticker rows, scanner tables, signal badges, score cards, flow cards, dark-pool prints, market-status pills, news/sentiment/wallet/broker/portfolio cards and post cards. Mobile laid out deliberately, not shrunk.

## Notes on the two blockers

- **PROMPT 6** needs a SnapTrade client ID/secret before the connection flow can go live; I'll build the schema + adapter and prompt you for the key at that step.
- **PROMPT 11 (GitHub docs file)** — I can't write to your GitHub repo from here. I'll add `docs/solana/SOLANA_DEVELOPER_RESOURCES.md` inside this project instead, which you can copy across.

## Technical details

- Engines are server-only; routes/components reach them exclusively through `*.functions.ts` server functions, so keys stay server-side.
- Each adapter declares its own rate limit and cache TTL; the core client enforces both and records `source`/`fetchedAt` used by `DataEnvelope`.
- Provider fallback is explicit and ordered per data kind; a fallback hit downgrades state to `delayed` and reports the actual source it served from.
- Existing route files and hooks stay in place; they are re-pointed at engine services incrementally so nothing goes dark mid-refactor.
- This project uses TanStack server functions, not Supabase Edge Functions, for protected external APIs — same security boundary, correct primitive for this stack.

## Sequencing

Phases 1 and 2 unblock everything else and are worth doing first as one unit. After that, tell me the order you want — or I'll proceed 3 → 4 → 5.
