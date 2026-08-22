# Finish SOLIQ's data layer: Twelve Data + projections + full Massive crypto universe

No rebuild, no redesign, no provider replacement. Everything below either connects, completes, or repairs code that already exists.

## What the audit found

Already built and working — leave alone:
- Provider gateway with per-provider rate budgets, caching, retry/backoff and ordered fallback (`src/engines/core/gateway.server.ts`, `firstAvailable`).
- Normalized asset/quote/candle model (`src/engines/core/types.ts`) and `ProviderId` registry union.
- Massive, Unusual Whales, Jupiter, DexScreener, CoinGecko, Alchemy, Plaid, SnapTrade adapters.
- Indicator + score engine (RSI, MACD, EMA/SMA, VWAP, ATR, ADX, bull/bear/risk/AI scores, signals) in `live-market.server.ts` and `indicators.server.ts`.
- Crypto dashboard (memecoin desk on Jupiter/DexScreener), stablecoin desk with peg history, scanner, futures desk, symbol dashboard.

Exists but incomplete or disconnected — the actual gaps:
1. **Twelve Data**: absent entirely; no key stored.
2. **Projections**: `forecast()` exists but is CoinGecko-only, hard-coded to 24h/7d/30d, has no bull/base/bear, and is rendered on exactly one page — `/asset/$id`, which is the crypto/memecoin page. So projections currently show where they should not, and are missing on stocks, ETFs, futures and forex.
3. **Massive crypto universe unused**: `massive.server.ts` already has the whole-market crypto endpoint wired (`groupedLocale.crypto`), but nothing ingests it. The crypto dashboard runs on Jupiter/DexScreener and `loadUniverse()` runs on CoinGecko, so the ~222 Massive-listed crypto assets never reach the UI.
4. **Stablecoin desk is a hard-coded 5-coin list** (`COINS` in `stablecoins.server.ts`) instead of a dynamic Massive-derived list.
5. **No classification/routing table** saying which provider owns which asset kind and data type; routing is per-module and implicit.

## Work to do

### 1. Twelve Data as an additional provider
- Add `TWELVE_DATA_API_KEY` to the secret store (requested securely; never reaches the client).
- New adapter `src/lib/twelvedata.server.ts` that goes **through the existing gateway** (`metered`, `fetchProvider`, existing cache) — no new caching or refresh architecture. Coverage: quotes, time series, technical indicators, forex, ETFs, crypto, commodities, fundamentals where the plan allows.
- Add `"twelvedata"` to the existing `ProviderId` union and a conservative budget entry in the gateway's `budgets` map (free-plan safe: batched symbols, long TTLs, no polling loops, no websockets).
- Endpoints that return "not available on plan" degrade silently and hand off to the existing provider, exactly like the Unusual Whales 401 handling already does.

### 2. Provider routing table
- One small module declaring, per asset kind + data type, the ordered provider list — Massive first for equities/futures/options, Twelve Data first for forex and as equity/ETF fallback, Jupiter/DexScreener/GeckoTerminal for DEX tokens, CoinGecko for broad crypto reference, Alchemy for on-chain, Unusual Whales for flow/dark pool.
- It feeds the existing `firstAvailable` candidate list. No second architecture, no per-provider analytics.

### 3. Complete the projection system
- Promote `forecast()` into a shared projection module that consumes the existing indicator/score output, and extend it to: bull / base / bear cases, expected range, direction, confidence, supporting signals, across Intraday, 1D, 3D, 1W, 2W, 1M, 3M, 6M, 1Y.
- Surface it on stock/ETF symbol pages, the futures & commodities desk, forex, and upgrade the existing major-crypto projection card in place.
- **Hard exclusion for memecoins**: the projection card is gated off for memecoin-classified assets. They keep price, volume, liquidity, momentum, trend, sentiment, risk and their existing signals.
- Wording stays model-based/probabilistic, keeping the existing disclaimer.

### 4. Ingest the full Massive crypto universe (the "222")
- Root cause: no ingestion path exists, not a filter or limit. The grouped crypto endpoint is present but uncalled.
- Add a universe loader that reads Massive crypto reference tickers + the grouped daily summary, normalizes `X:SYMBOLUSD` into the existing asset shape, and merges into the existing crypto lists by normalized symbol so no duplicates appear against CoinGecko/Jupiter rows.
- Classification is dynamic (stablecoin by peg pair and known pegged symbols, memecoin by existing classifier plus metadata, otherwise major crypto) so future Massive additions appear with no frontend edits.
- New rows land inside the **existing** memecoin, stablecoin and crypto sections. No section moves, no new dashboard, no new UI controls.
- Metadata (name, symbol, logo, exchange/market, asset type, provider id) comes from the best available provider through the routing table.

### 5. Stablecoin desk
- Replace the hard-coded `COINS` array with the dynamic Massive-derived stablecoin set, keeping the current peg/drift/on-chain-supply logic, charts and layout untouched.

### 6. Signals, sentiment, fallbacks
- New provider data flows into the same indicator/score/sentiment pipeline — no duplicate scoring engine.
- Verify degradation: with Twelve Data unavailable the app runs on existing providers; with Massive throttled the existing fallbacks serve. No frontend break on a single provider outage.

## Technical notes
- Files expected to change: `src/engines/core/types.ts`, `src/engines/core/gateway.server.ts`, new `src/lib/twelvedata.server.ts`, new provider-routing module, new projection module, `src/lib/live-market.server.ts`, `src/lib/live-market.functions.ts`, `src/lib/stablecoins.server.ts`, `src/lib/massive.server.ts` (universe loader), `src/routes/asset.$id.tsx`, and the stock/futures/forex symbol surfaces. Server-only logic stays in `.server.ts`; UI reaches it through existing `.functions.ts` wrappers.
- No new database tables. Existing `assets` / `asset_prices` rows are upserted through the existing `repo.server.ts` helpers.
- No new packages, no auth/navigation/branding changes, no refactors outside the above.

## Deliverable
A concise report at the end: what already existed, what was disconnected, what was fixed, how Twelve Data was wired, which provider owns which data, how the Massive assets were ingested and classified, how projections were connected and memecoins excluded, files changed, and anything still genuinely blocked.
