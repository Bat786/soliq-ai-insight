# Replace the Unusual Whales API key

The whale flow feed currently fails with `authentication_required` (401), so the whale cards fall back to "unavailable" messaging. The fix is a new valid key — no code changes required.

## Steps

1. You paste a fresh Unusual Whales API token into a secure form (the value never appears in chat or code). Get it from your Unusual Whales account under API access.
2. The key is stored as `UNUSUAL_WHALES_API_KEY`, which the existing server code already reads.
3. Verify live: call the whale feed server function and confirm it returns `available: true` with real net premium / put-call data instead of the 401 message.
4. Check the status page entry for Unusual Whales flips to "live", and confirm the whales dashboard and the whale cards on asset pages render real numbers.

## Technical notes

- Consumers of the key: `src/lib/unusual-whales.server.ts`, `src/lib/futures.server.ts` (ticker metadata), `src/lib/provider-probe.server.ts`, `src/lib/status.server.ts`.
- Graceful-degradation handling for 401/403 stays in place, so an expired key in future still won't crash the UI.
- If the new key lacks entitlement for specific endpoints (e.g. market tide), the probe output will name which ones, and those sections stay hidden rather than erroring.
