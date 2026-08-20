# Regression recovery and standard wallet provider

## Goal
Restore the existing authentication, Solana wallet, live-market, Plaid, and SnapTrade paths without adding unrelated features. Each item is complete only after a targeted browser/server test passes.

## 1. Establish regression tests first
- Add focused tests/scripts for desktop email sign-in behavior, injected Solana extension discovery and connection, public live-market loading under provider failures/rate limits, and authenticated bank/brokerage server functions.
- Capture the current failure signal before changing each path, then rerun the same check after the fix.
- Treat unavailable third-party credentials/accounts as an explicit verification boundary: verify request construction, auth propagation, database persistence, and graceful provider errors without claiming a successful real institution/brokerage connection unless the provider completes it.

## 2. Fix authentication and hydration at the root
- Keep email/password submission a real accessible form after hydration, while preventing pre-hydration native navigation from losing the request.
- Remove the heavy Solana/EVM provider bundle from public/auth route startup so wallet code cannot delay or break authentication hydration.
- Verify desktop sign-in stays on `/auth`, reaches the auth API, displays invalid-credential errors, and redirects an authenticated session to `/terminal`.

## 3. Replace the Solana setup with the standard adapter composition
- Use the official package structure exactly: `ConnectionProvider` → `WalletProvider wallets={wallets} autoConnect` → `WalletModalProvider`.
- Install/use `@solana/wallet-adapter-wallets` and construct a stable adapter array with real adapter instances for Phantom, Solflare, and Backpack where the package exports them; retain Wallet Standard auto-registration for modern injected wallets.
- Use the official `WalletMultiButton`/modal selection flow instead of custom `select()`/`connect()` timing logic for desktop. Keep mobile deep links separate and only available in genuine mobile/no-extension states.
- Mount wallet providers around application routes that use wallets, not around `/auth` or the marketing page.
- Verify with mocked injected desktop providers that the adapters appear as detected and clicking connect invokes the injected provider rather than navigating to a download website.

## 4. Fix live-data freezing at the provider boundary
- Remove long serialized waits caused by consuming a low per-minute token before queueing retries, and ensure every external request has a bounded timeout/abort path.
- Stop retry/backoff work after a request is already known to be unavailable, and deduplicate concurrent requests for the same cache key.
- Prevent the Yahoo fallback from stampeding repeatedly after 429 responses; use a shared cooldown and stale/cache return.
- Preserve the existing provider fallback order and return explicit unavailable envelopes instead of hanging or throwing from polling queries.
- Verify ticker boards and SPY detail resolve within a fixed time even when Massive, Unusual Whales, and Yahoo are mocked as 401/429/timeouts, and verify no unhandled promise rejections occur during repeated polling.

## 5. Restore Plaid and SnapTrade sync paths
- Correct persistence defects that currently discard or duplicate provider records: validate every database error, use the actual unique keys, and upsert positions/transactions instead of repeated inserts.
- Ensure SnapTrade user registration does not create an invalid placeholder connection row and that portal success triggers connection refresh plus holdings/balance reload.
- Keep SnapTrade on its production API host; confirm no sandbox override exists. Keep Plaid environment driven by `PLAID_ENV`, but fail closed on an invalid value rather than silently falling back to sandbox.
- Make Plaid script loading idempotent and propagate useful provider errors through the existing UI.
- Verify authenticated server functions carry the session, configured providers can mint link/portal tokens, successful mocked callbacks persist and reload balances/holdings, and repeated syncs are idempotent.

## 6. Final end-to-end verification
- Run the relevant automated tests and inspect browser screenshots for `/auth`, wallet selection, live market pages, and the existing brokerage/bank surfaces.
- Check browser console, server logs, and network requests for uncaught errors, native form reloads, extension redirects, hanging requests, and repeated database conflicts.
- Report each flow separately as passed, blocked by an external provider/user account, or still failing; do not call the recovery complete while any reproducible regression remains.

## Technical notes
- No new product surface or Connections portal consolidation in this recovery pass; this is limited to fixing existing paths.
- Server-function modules remain thin wrappers; credentials stay server-side.
- Database fixes will be delivered through a migration with explicit grants/RLS preserved for every affected table.
