# Post-Go-Live Verification and Cleanup

Go-live is complete: account claimed, live form submitted, Lovable app installed, live API keys provisioned, and the readiness check passed. Nothing is flagged as failing. This plan covers verifying the live chain end to end and closing the remaining loose ends noted earlier.

## 1. Live billing verification (no real charge)

- Create a live embedded checkout session for each of the four prices (`soliq_pro_monthly`, `soliq_pro_yearly`, `soliq_professional_monthly`, `soliq_professional_yearly`) and confirm each returns a client secret without error.
- Confirm the live webhook endpoint on the published site responds and is registered for the subscription and checkout events the handler switches on.
- Confirm the production build is shipping the live publishable token so checkout does not silently route to the wrong environment.

## 2. Test-mode full-chain regression

Re-run the sandbox suite against the current code (throwaway user, all four plans) to confirm:
- Webhook writes the subscription row with the right `price_id` and period end.
- Entitlements resolve Elite over Pro over Free, and cancellation keeps access until period end.
- Gated Elite features unlock and re-lock correctly.

## 3. Live smoke test (your action, my verification)

You buy Pro monthly with a real card on soliqintel.com. I then confirm the subscription row, the tier flip in the UI, and walk you through the refund/cancel so the charge is reversed.

## 4. Loose ends to close

- Fill the two legal placeholders in the Terms of Service: arbitration venue and governing-law state.
- Confirm the customer billing portal opens from Settings for a live subscriber so users can cancel without support.
- Confirm the test-mode banner is hidden on production and the go-live-not-configured notice never shows.
- Note the remaining data-provider upgrades (Plaid production access, Massive premium tier) — these are account actions on your side, not code changes.

## Technical notes

- Checkout stays embedded (`ui_mode: "embedded_page"`) with `return_url`; no redirect flow is introduced.
- Price resolution continues through `lookup_key`, so sandbox and live share the same identifiers.
- Entitlement mapping keys off `price_id`, never the environment-specific Stripe product id.
- No schema changes expected; `public.subscriptions` and its RLS already cover this.
