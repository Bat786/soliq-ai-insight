# PRISM multi-horizon trend chart

Add a visual fan chart to the PRISM projection panel so bull, base and bear paths — plus confidence — can be compared across all twelve horizons (15m → 1Y) at a glance, instead of reading twelve small cards.

## What you'll see

- A wide chart above the horizon cards, plotting the projected price path from the spot price out to 1 year:
  - Shaded expected-range band (the ~80% low/high) as the outer envelope.
  - Bull line (green), base line (neutral/primary), bear line (red).
  - Spot marked as the left anchor so every path visibly starts from the live price.
- A second, thin strip beneath it showing confidence per horizon as bars, making the decay from intraday to 1Y obvious.
- Horizons are spaced by log time so 15m–4h are readable next to 1Y rather than squashed at the left edge.
- Hovering any horizon shows a tooltip with its label, bull/base/bear prices, expected range and confidence; clicking selects that horizon so the existing scenario card underneath updates in sync with the highlighted point.
- Existing panel content stays: header line, horizon cards, scenario card, signal chips, disclaimer.

## Where it appears

Everywhere the panel already renders, since it lives inside the panel itself: stocks, futures/metals and FX desk detail views, the per-symbol dashboard, and major-crypto asset pages. Memecoins still render nothing.

## Technical notes

- New component `src/components/soliq/ProjectionFanChart.tsx`, built with the already-installed `recharts` (`ComposedChart` + `Area` for the band, `Line` for bull/base/bear, `Bar` for confidence in a second small chart), styled with existing semantic tokens (`--bull`, `--bear`, `primary`, `surface-2`) — no hardcoded colors.
- Data comes entirely from the existing `ProjectionSet` already returned by `projectSeries`; no new fetches, no server changes, no projection-math changes.
- `src/components/soliq/ProjectionPanel.tsx` mounts the chart and passes `selected` / `onSelect` down so chart and cards share one selection state.
- Responsive: chart height ~220px on desktop, ~170px on mobile via `ResponsiveContainer`; the confidence strip collapses on very narrow screens.
