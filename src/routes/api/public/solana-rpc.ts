import { createFileRoute } from "@tanstack/react-router";

import { alchemyRpcUrl, solanaNetwork } from "@/lib/solanaWallet.server";

/**
 * JSON-RPC proxy to Alchemy's Solana node. Keeps ALCHEMY_API_KEY server-side:
 * the browser's web3.js Connection points here, we forward to Alchemy.
 * Read-only RPC — Solana JSON-RPC needs no credentials of the caller, and
 * signing always happens in the user's wallet, never on this route.
 */
export const Route = createFileRoute("/api/public/solana-rpc")({
  server: {
    handlers: {
      GET: () => Response.json({ ok: true, network: solanaNetwork(), provider: "alchemy" }),
      POST: async ({ request }) => {
        const body = await request.text();
        if (body.length > 200_000) return new Response("Payload too large", { status: 413 });

        try {
          const upstream = await fetch(alchemyRpcUrl(), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
          });
          return new Response(await upstream.text(), {
            status: upstream.status,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        } catch (error) {
          return Response.json(
            { error: { code: -32603, message: error instanceof Error ? error.message : "RPC proxy failed" } },
            { status: 502 },
          );
        }
      },
    },
  },
});
