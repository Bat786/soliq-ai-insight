# Wire Twelve Data into the stocks / FX / commodities pipeline

Today Twelve Data only feeds one place: the per-symbol dashboard (`/symbol/...`), where it sits between Massive and the keyless backup tape. The desk boards that power the Stocks, Forex and Futures/commodities pages (`loadTapeBoard` / `loadTapeDetail`) never call it, so when Massive is throttled or unentitled those rows fall through to close-only public feeds — and thin, volume-less series weaken RSI/MACD/VWAP scoring and the multi-timeframe bull/bear signals computed from them.

The goal is to make Twelve Data a first-class source inside the *existing* pipeline: same `Bar` shape, same `indicators()`, same `tfSignal()` multi-timeframe scoring, same row/board types. No new UI system, no provider replacement.

## What changes for the user

- Stocks, Forex and Futures/commodities rows price up with real OHLCV (with volume) far more often instead of showing "syncing" or a flat proxy series when the primary feed is busy.
- Indicator stacks and bull/bear signals on those desks become more reliable because they are computed from true open/high/low/close/volume bars rather than close-only fallbacks.
- Each row and the detail chart says which feed it came from, so a Twelve Data-served row is visibly labelled rather than silently mixed in.
- Commodities (gold, silver, copper, crude, nat gas) and FX crosses gain a real intraday source rather than an ETF proxy or daily ECB close.
- Stock research falls back to Twelve Data statistics (market cap, P/E, EPS, 52-week range, beta) when the primary fundamentals slice is unavailable.

## Technical plan

### 1. Twelve Data symbol mapping for desk instruments
In `src/lib/tape.server.ts`, add a resolver that maps an `Instrument` to a Twelve Data symbol, or `null` when there's no sane mapping:
- `stocks` → the ticker as-is (`NVDA`, `SPY`).
- `fx` → `EUR/USD` style from the 6-char key; `DXY` stays `null`.
- `crypto` → `BTC/USD` style.
- `futures` → commodity/index spot equivalents (`GC → XAU/USD`, `SI → XAG/USD`, `CL → WTI/USD`, `NG → NG/USD`, `HG → COPPER/USD`, `PL → XPT/USD`); index contracts keep using the existing ETF-proxy path. Anything unmapped is `null`.
- `indices` → skip (proxy path already covers it).

Reuse `tdSymbol()` from `src/lib/twelvedata.server.ts` where it already fits instead of duplicating conventions.

### 2. Insert Twelve Data into the board ladder
In `loadTapeBoard`, add a step between the Massive whole-class pass (step 1) and the keyless spark/proxy/fallback steps: for instruments still missing a series, request Twelve Data bars — batched by shared interval, capped to a small number of symbols per poll, ordered by desk priority (commodities and FX first, since those benefit most), and time-boxed with the same `cap()` helper so a slow provider can't stall the board. Results go into the same `series` map, so `toRow()` computes indicators and signals unchanged.

Budget discipline: the module keeps its 10-minute `cache`/TTL, requests go through `twelveDataBars` (already metered by the shared gateway at ~7/min with per-scope TTLs), and rows already served by Massive are never re-fetched.

### 3. Detail view + provenance
- `loadTapeDetail`: try Massive at the requested timeframe, then Twelve Data at the mapped interval (`tdInterval`), then the existing continuous tape / keyless / ETF-proxy chain.
- Add an optional `source: "massive" | "twelvedata" | "tape" | "binance" | "frankfurter" | "proxy" | "none"` field to `MarketRow` (so `MarketBoard` and `MarketDetail` inherit it) and set it where each series is written.
- Surface it as a small provider label in `src/components/soliq/MarketsBoard.tsx` rows and in the Terminal detail header, matching existing muted-caption styling.

### 4. Fundamentals fallback for stock research
In the equity research path, when the primary profile/valuation slice returns nothing, fill market cap, P/E, forward P/E, EPS, dividend yield, beta, revenue, shares outstanding and 52-week range from `twelveDataStatistics()`. Existing fields and shapes stay the same; only missing values get filled, and a note records the fallback the way current notes do.

### 5. Verification
- Call `getTapeBoard` for `stocks`, `fx` and `futures` and confirm rows report `live`, non-zero volume where expected, populated `indicators` and 5 timeframe signals.
- Call `getTapeDetail` for `GC`, `CL`, `EURUSD` and `NVDA` at `5m`/`1h`, confirming bar counts and the reported source.
- Check the Stocks and Futures pages in the browser for provider labels and no regression in existing rows.
- Confirm Twelve Data's status entry still reports correctly, and that removing/failing the key leaves the previous behaviour intact.

## Out of scope

- No changes to crypto memecoin/stablecoin desks or the projection engine.
- No new polling loops, websockets, or replacement of Massive as primary.
