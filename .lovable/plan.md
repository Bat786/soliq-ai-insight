# 20-Credit Build — Crypto Split, Memecoin Pages, Nav Polish

Tight scope, publishable at the end. Everything below reuses existing data and providers — no new services, no rebuilds.

## What ships

1. **Majors vs Memecoins split (the main complaint)**
   The Crypto Desk gets a third tab, **Majors**, listing the established assets (Bitcoin, Ethereum, Solana, XRP, BNB…) from the market snapshot the app already loads. Memecoins and stablecoins keep their own tabs, so majors stop appearing in the memecoin desk. Rows open the existing asset intelligence page.

2. **Memecoin niche categories**
   Filter chips on the memecoin desk — AI, Gaming, DeFi, Solana ecosystem, Animals, Political, Community, New launches, Other — derived from data already fetched, with live counts. No extra provider calls.

3. **In-app memecoin detail page**
   Clicking a memecoin now stays inside SOLIQ instead of jumping to Jupiter: price, change, market cap, liquidity, volume, buy/sell activity, trade counts, holders, audit flags, candles with timeframe controls, RSI/MACD/VWAP, Bollinger bands, support/resistance, volatility and breakout compression. Blocks that have no data say so rather than showing invented numbers. The Jupiter/DexScreener links remain as secondary references.

4. **Bottom navigation + mobile pass**
   Modern floating bottom nav (rounded glass bar, active pill, safe-area aware) replacing the flat strip, plus fixes to the header/ticker crowding and overlap on small screens.

## Out of scope for this build

Scanner families, PRISM/AETHRON work, credits, SnapTrade production, Plaid removal, portfolio and trading — those stay in the approved larger plan for a later, separately approved batch.

## Technical notes

- Majors tab filters the existing universe snapshot by sector (excluding memecoin/stablecoin); no ingestion changes.
- Categories live in a small client-safe classifier module over symbol/name/age already present on the rows.
- Detail route `/token/$mint` is backed by one server function that reuses Jupiter search, DexScreener pair lookup and GeckoTerminal pool OHLCV, then the shared indicator math; memecoins deliberately get no price projection.
- Nav/mobile changes are presentation-only, inside the existing app shell and design tokens.

## Verification

Build check plus a live preview pass on desktop and mobile widths for the three crypto tabs, a memecoin detail page and the new bottom nav.

Estimated: ~20 credits.
