# Activate live billing and verify checkout → webhook → entitlements

## Where things stand (verified)

- Your Stripe live account is connected and live API keys are provisioned. The only remaining go-live step is the **readiness check**, which you run from the Payments tab.
- Live webhook endpoints were created automatically with the live keys, pointing at the app's webhook route with `env=live`.
- Both prices per tier exist as stable lookup keys: `soliq_pro_monthly` / `soliq_pro_yearly` and `soliq_professional_monthly` / `soliq_professional_yearly`.
- The webhook already handles subscription created/updated/deleted, `checkout.session.completed`, and `invoice.paid`, and entitlements resolve the tier from the price id (Pro vs Elite), so annual and monthly map to the same tier.
- Live checkout only runs on the **published** site (the preview always uses the test token), and any live test is a **real charge on a real card** that has to be refunded afterwards.

## Plan

### 1. Finish go-live
- You run the readiness check in the Payments tab; I fix anything it flags (missing tax codes, price/product sync, webhook config).
- Publish the app so the production build picks up the live client token.

### 2. Full automated test in test mode (all four prices)
I drive a real browser against the app and, for each of Pro monthly, Pro annual, Elite monthly, Elite annual:
- open checkout from the pricing UI, pay with the Stripe test card,
- confirm the return page resolves the session,
- confirm the webhook wrote a subscription row with the right price id, status, and period end,
- confirm the account's tier flips to Pro/Elite and gated surfaces unlock,
- confirm cancel/downgrade through the billing portal drops entitlements at period end.

This proves the whole chain (checkout → webhook → entitlements) without spending real money, since the code path is identical apart from which key set is used.

### 3. Live smoke test (one real charge, your card)
Because live checkout needs a genuine card, you do this part on the published site while I watch the data:
- purchase Pro monthly ($20) with your own card,
- I verify the live webhook delivery, the `live` subscription row, and that your account shows Pro,
- you cancel and I confirm the cancellation propagates; you refund the charge in Stripe.

Optionally repeat with Elite monthly ($30) if you want both tiers proven live. Annual prices share the exact same code path as monthly, so I'd recommend not charging $200/$300 to test them.

### 4. Fix and re-verify
Anything that fails at any step, I fix and re-run that leg of the test, then report the final state of all four price paths.

## Technical notes

- Test-mode verification uses the sandbox client token in preview plus direct reads of the `subscriptions` table filtered on `environment = 'sandbox'`; live verification reads the same table filtered on `environment = 'live'`.
- Checkout sessions use embedded mode with full compliance handling enabled, so live sessions will show the `LINK.COM*` statement descriptor and the +3.5% per-transaction cost.
- I will not create, rename, or version any product/price ids — existing lookup keys are reused so test and live stay in sync.

## Your decision

Tell me whether to (a) run the full test-mode suite now and hand you the live smoke test after publishing, or (b) wait until you've run the readiness check and published, then do both in one pass.
