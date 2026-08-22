# SOLIQ — Surgical Maintenance Pass (hard budget: under 10 credits)

No rebuilds, no redesign, no new providers, no new dependencies. Only targeted fixes to what already exists. If an item can't be done safely inside the budget, it is skipped rather than expanded.

## Confirmed from inspection

- Build is currently OK. One TypeScript error appeared mid-session from an unfinished helper (`token-intel.server.ts` importing a non-existent `gtPoolOhlcv`); the latest build passes, so this file is checked and either corrected or removed.
- Plaid is real and localized: `src/lib/plaid.server.ts`, `src/lib/bank.server.ts`, `src/lib/bank.functions.ts`, `src/components/soliq/BankAccountsPanel.tsx`, plus references in `src/lib/status.server.ts`, `src/routes/support.tsx`, and one mount in `src/routes/portfolio.tsx`.
- SnapTrade already runs against the production host `api.snaptrade.com` using the official SDK with `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY`. There is no sandbox branch in the code — so this is a credentials check, not a code migration.
- `src/routes/brokerage.tsx` contains no tier/entitlement references, so brokerage is currently ungated. The SnapTrade connect flow already accepts a `read` vs `trade` connection scope, which is what the Pro/Elite split hangs off.

## What ships

1. **Plaid removal.** Delete the Plaid server module, bank connection server functions and the bank accounts panel; drop the mount in the portfolio route, the Plaid entries in status reporting, and the Plaid wording in support. Brokerage connection stays SnapTrade-only. Bank tables are left in the database untouched (no destructive migration).

2. **SnapTrade production confirmation.** Verify the two existing secrets are the production pair and, if you provide new values, store them through the existing secrets system (never in frontend code). Remove any leftover test/sandbox wording in the brokerage UI. No integration rewrite.

3. **SnapTrade paywall (server-enforced).** Tier is re-read server-side inside the existing brokerage server functions:
   - Orbit/Free: connect and sync blocked; the brokerage route shows a polished locked card — "Brokerage Intelligence — Connect your brokerage through SnapTrade and bring your portfolio into SOLIQ. Available with Pro & Elite."
   - Pro: connect, sync, holdings, positions, value, P&L, transactions, analytics and charts — view-only. Connection requested with `read` scope; no Buy/Sell surfaces rendered.
   - Elite: everything in Pro plus Buy/Sell actions, requested with `trade` scope, and shown only for accounts the brokerage reports as trade-capable.

4. **Entitlement check fixes.** Audit the existing tier resolution so Orbit=free, Pro=sync/analytics, Elite=sync+trading, using the current Stripe/subscription infrastructure as-is. Fixes only — no billing changes.

5. **Scanner fixes only.** Verify filters, sorting, gainers/losers/top movers, and that existing RSI/MACD/VWAP/volume/breakout fields render (empty states where data is genuinely absent). Fix obvious errors and UI breaks; no new architecture or data sources.

6. **Branding touch-ups** limited to the strings already being edited: SOLIQ — Financial Intelligence Platform, AETHRON — Intelligence Engine, PRISM — Projection Engine.

## Out of scope

Majors/memecoin desk split, memecoin category chips, in-app token detail page, bottom-nav redesign, credits/passes, new scanner families. Those stay in the larger plan for a separate, separately approved batch.

## Verification

One build check, one live pass over `/brokerage`, `/portfolio` and `/scanner`, and a tier check on the locked state. No repeated retries of the same operation.

## Budget stop rule

Work proceeds in the priority order above. If the remaining budget won't cover the next item safely, work stops there and I report what's left rather than continuing.
