# PRISM Projection Engine — rename, intraday horizons, full market coverage

Small surgical pass on the existing projection code. No new providers, no new data pipelines, no redesign. Budget-conscious: five files touched.

## What changes for you

- Every projection surface is renamed from "SOLIQ AI / price projection" to **PRISM Projection** — SOLIQ's projection engine — with research-desk wording: intelligence, signals, confidence, risk, market context, discovery.
- Short-horizon projections added: **15 minutes, 30 minutes, 1 hour, 4 hours**, alongside the existing 1D / 3D / 1W / 2W / 1M / 3M / 6M / 1Y ladder.
- PRISM appears on stocks, crypto majors, futures, metals/commodities and FX — including the desk detail view on the Stocks / Futures / Forex pages, which currently has indicators but no projection.
- Memecoins keep price, liquidity, momentum, trend and risk analytics but stay excluded from projections (existing `isProjectableKind` gate is unchanged).

## Technical plan

1. `src/lib/projections.ts`
   - Add four intraday entries to `HORIZONS` (`15m`, `30m`, `1h`, `4h` as fractional days) and extend the `ProjectionHorizon` union; drop the redundant loose `intraday` entry in favour of the explicit set.
   - Update `model` label to `PRISM` and reword the disclaimer to signal/confidence/risk language ("probabilistic market-context model … research, not financial advice").
   - Existing drift damping, volatility band and confidence decay math stays as-is.

2. `src/components/soliq/ProjectionPanel.tsx`
   - Default title → `PRISM projection`; subheader reads as an intelligence readout (model, sample window, annualised volatility, confidence).
   - "Supporting signals" panel label kept; empty state reworded to "no dominant signal — market context is trend-neutral".
   - Default selected horizon points at `1h` instead of index 3.

3. `src/lib/tape.server.ts`
   - In `loadTapeDetail`, run the existing `projectSeries()` over the already-fetched `bars` and attach `projection` to `MarketDetail`. No extra provider calls — reuses bars already loaded for the chart.

4. `src/components/soliq/MarketsBoard.tsx`
   - Render `ProjectionPanel` in the detail view for stocks / futures / metals / FX rows using the new field.

5. Copy-only touch-ups in `src/routes/asset.$id.tsx` and `src/routes/symbol.$market.$symbol.tsx` — titles and meta descriptions move from "AI price projection" to "PRISM projection", keeping the intelligence/analysis vocabulary.

## Out of scope

- No changes to memecoin desks, scanner, billing or providers.
- No new horizons beyond the set above, no backtesting of the model.
