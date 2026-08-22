# PRISM explainer tooltips

Add short, plain-language hover/tap explanations to the PRISM projection panel so the numbers explain themselves. Because every desk (stocks, futures, FX, metals, crypto, symbol pages) renders the same shared panel, one change covers all of them.

## What the user gets

Small info hints next to five spots, each opening a 1-2 sentence explanation with the live values filled in:

1. **Confidence** (on each horizon card's "x% conf" and in the scenario box) — what the number means and that it decays the further out the horizon goes.
2. **Expected range** — that it's the ~80% band the model expects price to stay inside for the selected horizon, showing the low-high.
3. **Risk context** (header line) — annualised volatility and the trailing data sample the read was fitted on, explained as "how jumpy this market has been".
4. **Bull / base / bear** — that these are scenario paths, not targets, with the percent move from spot.
5. **Signals behind this read** — that the tags are the indicator signals tilting the projection.

Also: the disclaimer stays visible, and tooltips work on touch (tap to open) so mobile users get the same context.

## Technical notes

- All edits in `src/components/soliq/ProjectionPanel.tsx`; no changes to projection math or loaders.
- Use existing `@/components/ui/tooltip` (Radix). There is no app-wide `TooltipProvider`, so wrap the panel's root `<section>` in one with a short delay.
- Add a tiny reusable `Hint` subcomponent (info icon button + `TooltipContent`) inside the panel file; make it a real `<button type="button">` with `aria-label` so keyboard and touch both trigger it.
- Tooltip copy is derived from the active `Projection` / `ProjectionSet` fields already in scope (`confidence`, `low`/`high`, `volatilityPct`, `sampleDays`, `drivers`) — no new data.
- Keep hint icons visually quiet (muted, ~10-11px) so the dense card grid stays readable.
