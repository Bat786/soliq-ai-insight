# SOLIQ Enhancement — Inspection Findings & Credit Estimate

No code has been changed. Below is what I found in the current codebase, what is already built vs. genuinely missing, and a credit range per work block.

## Estimate caveat

Build-mode credits are usage-based (complexity, iterations, verification), so exact numbers can't be guaranteed. Plan-mode messages are 1 credit each. The ranges below are my honest working estimate, not a quote.

## Inspection results

Verified this turn:

- Build is currently clean (`build OK`, no build errors logged).
- Crypto route (`src/routes/crypto.tsx`) exposes only two desks: **Memecoins** and **Stablecoins**. The Massive universe classifier (`src/lib/massive-crypto.server.ts`) already produces three categories — `crypto`, `stablecoin`, `memecoin` — and exposes a per-category slice helper. So the ~222 majors are already classified correctly in data; they just have **no UI home**, which is why they surface alongside the memecoin desk. This is a wiring fix, not a rebuild.
- A universal asset intelligence page already exists twice: `src/routes/asset.$id.tsx` (crypto: chart, indicators, whale signal, bull/bear gauge, projection, on-chain stats) and `src/routes/symbol.$market.$symbol.tsx` (stocks/FX/futures). Memecoin rows in `CryptoDesk.tsx` currently link **out** to `jup.ag` instead of into these pages.
- Projections exist (`src/lib/projections.ts`, `ProjectionPanel.tsx`) with bull/base/bear + confidence. There is **no PRISM naming and no per-timeframe matrix**; the engine itself is built.
- AETHRON exists as branding only in copy; `src/lib/ai.server.ts` + `ai_insights` / `ai_requests` tables exist, so explanation generation has a home already.
- Scanner (`src/routes/scanner.tsx`, `FullMarketScan.tsx`, `scan.server.ts`, `scanner_results` table) exists with filters. Missing: preset scan families (momentum/breakout/gap/unusual/reversal/hidden gems), session modes (premarket / intraday / post-market), saved custom scans, value scanner, penny-stock scanner, long/short setup labelling.
- Tier system is solid and server-backed: `subscriptions` table, `effective_tier` / `has_active_subscription` / `is_paid_member` DB functions, `entitlements.ts`, `TierGate.tsx`. Gating just isn't applied consistently — e.g. the scanner route has no tier check at all.
- SnapTrade uses `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY` against `https://api.snaptrade.com/api/v1/`. There is **no sandbox base URL and no environment switch in code** — the environment is decided purely by which credential pair is stored. So "removing sandbox" is a credential + verification task, plus removing any test-flavoured UI copy; there is no sandbox code path to delete. Broker tables (`broker_connections`, `broker_accounts`, `broker_positions`, `broker_transactions`) already exist. No trading/order tables or order placement code exists.
- Plaid is live in `src/lib/plaid.server.ts`, `bank.server.ts`, `bank.functions.ts`, `BankAccountsPanel.tsx`, `status.server.ts`, `support.tsx`, plus `bank_accounts` / `bank_connections` tables. Removal is contained but touches the status page and support copy.
- Alchemy is already wired (Solana RPC proxy, stablecoin on-chain supply/balances, wallet activity). Extension only.
- Stripe is production-wired through the gateway (`stripe.server.ts`, `payments.functions.ts`, webhook route). **No credits, passes, or one-time purchase support exists** — subscriptions only. No credit balance/ledger tables.

## Already built (wiring/fix only)

Majors classification, universal asset pages, projection engine, fundamentals (`equity.server.ts` + `StockResearch.tsx`), tier/entitlement infrastructure, scanner core + persistence, SnapTrade connect flow and broker tables, Alchemy, Stripe subscriptions, watchlists/alerts, AI infrastructure.

## Genuinely new development

Majors desk UI, memecoin category taxonomy, memecoin-flavoured detail view, scanner preset families, session-aware scanners, saved custom scans, value + penny-stock scanners, long/short setup scoring, PRISM timeframe matrix, AETHRON explanation surfaces, credits ledger + Stripe one-time purchases + passes, portfolio holdings analytics, Elite trading (order placement + status), Plaid removal, mobile layout pass + new bottom nav treatment.

## Credit estimate by block

| # | Block | Estimate |
|---|---|---|
| 0 | Bug fixes / cleanup: broken links, duplicate fetches, unconnected components, console + responsive bugs | 15–30 |
| 1 | Crypto dashboard: Majors desk tab, correct memecoin separation | 10–20 |
| 2 | Memecoin categories from existing data (AI, gaming, animals, political, Solana, new launches, trending) | 15–30 |
| 3 | Memecoin detail pages routed into SOLIQ instead of Jupiter, reusing existing asset page | 25–45 |
| 4 | Universal asset intelligence: adapt existing pages per asset class | 20–40 |
| 5 | Scanner enhancements: preset families, long/short setups, premarket / intraday / post-market modes | 60–110 |
| 6 | Custom saved scans (builder + persistence) | 25–45 |
| 7 | Value/quality scanner on existing fundamentals | 20–40 |
| 8 | Penny/small-cap scanner with quality filtering | 15–30 |
| 9 | PRISM: rename, timeframe matrix, confidence/catalysts/risks, no-data honesty | 30–55 |
| 10 | AETHRON explanations across asset, scanner, portfolio surfaces | 30–55 |
| 11 | Fundamentals presentation polish | 10–20 |
| 12 | Paid-feature gating across the whole app, server-enforced | 30–55 |
| 13 | Free vs delayed/live data policy enforcement | 15–30 |
| 14 | SnapTrade production verification + test UI removal | 15–30 |
| 15 | Plaid removal (code, UI, tables, status/support copy) | 10–20 |
| 16 | Pro portfolio sync + holdings/P&L/allocation/performance analytics | 45–80 |
| 17 | Elite trading (Buy/Sell, eligibility checks, order status) | 50–90 |
| 18 | Intelligence Credits: ledger, balance UI, cost config, confirmations, refund-on-failure | 55–95 |
| 19 | Stripe one-time credit packs + day/week passes + webhook entitlements | 35–60 |
| 20 | Alchemy deepening where it adds real intelligence | 20–40 |
| 21 | Branding family (PULSE/FLOW/VECTOR/SENTINEL/NEXUS/ORBIT/TAPE) + premium copy | 20–35 |
| 22 | Mobile/desktop layout pass + modern bottom nav treatment | 25–45 |
| 23 | Final build/test/verification sweep | 15–25 |

**Total: roughly 610–1,120 credits**, most likely landing near the middle if we stage the work and I verify each phase before moving on.

Cheapest high-value cluster first: blocks 0, 1, 2, 3, 15, 14 (~90–175) delivers the crypto reorganization, in-app memecoin pages, Plaid removal and SnapTrade production in one pass.

## Cost/ops notes

- New scanner families and session scanners increase provider request volume (Massive, Twelve Data, Unusual Whales). I'll batch and cache within existing rate-limit budgets rather than adding a provider.
- Premarket/post-market data availability depends on current entitlements; I'll verify per provider before promising a session scanner and disclose gaps instead of faking them.
- AETHRON explanations and PRISM runs consume AI gateway usage — that's exactly what the credits system is meant to meter.

## Technical approach (summary)

- Add a **Majors** desk to `crypto.tsx` fed by the existing `crypto` category slice; no changes to the ingestion pipeline.
- Derive memecoin categories from existing name/metadata plus Jupiter/DexScreener fields already fetched — extend `classifyCryptoSymbol` with a tag layer, no new provider calls.
- Route memecoin rows to `asset/$id` (or a mint-aware variant) instead of `jup.ag`, and make the existing panels conditional per asset class so irrelevant metrics hide themselves.
- Scanner presets become named filter configurations over the existing `scan.server.ts` pipeline; saved scans persist in a new table with RLS + grants.
- PRISM wraps `projections.ts` with a timeframe matrix and honest no-data states; AETHRON explanations go through `ai.server.ts` with a server-side credit debit.
- Credits: new `credit_balances` + `credit_ledger` tables with RLS + grants, configurable per-operation costs, debit inside the server function after success only, top-ups via existing Stripe gateway webhook.
- Gating stays server-enforced via `effective_tier` / `has_active_subscription`; client gates remain UX only.

## Execution order

Phase 1 bugs → Phase 2 crypto split → Phase 3 memecoin categories + asset pages → Phase 4 scanner → Phase 5 PRISM/AETHRON → Phase 6 gating → Phase 7 SnapTrade production, Plaid removal, portfolio, trading → Phase 8 credits + Stripe → Phase 9 branding, mobile/nav polish → Phase 10 final verification.

I'd suggest approving in stages so you can stop after any phase.
