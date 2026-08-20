import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { alchemyRpcUrl, solanaNetwork } from "@/lib/solanaWallet.server";

const allowedMethods = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlockHeight",
  "getFeeForMessage",
  "getGenesisHash",
  "getLatestBlockhash",
  "getMultipleAccounts",
  "getSignatureStatuses",
  "getSignaturesForAddress",
  "getSlot",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTransaction",
  "getVersion",
  "isBlockhashValid",
  "simulateTransaction",
]);

const rpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string().max(100), z.number().finite(), z.null()]).optional(),
  method: z.string().min(1).max(80),
  params: z.array(z.unknown()).max(20).optional(),
});

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
          const parsed = JSON.parse(body) as unknown;
          const calls = Array.isArray(parsed) ? parsed : [parsed];
          if (calls.length === 0 || calls.length > 20) {
            return Response.json({ error: { code: -32600, message: "Invalid JSON-RPC batch" } }, { status: 400 });
          }
          const validated = calls.map((call) => rpcRequestSchema.parse(call));
          if (validated.some((call) => !allowedMethods.has(call.method))) {
            return Response.json({ error: { code: -32601, message: "RPC method not allowed" } }, { status: 403 });
          }

          const upstream = await fetch(alchemyRpcUrl(), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(Array.isArray(parsed) ? validated : validated[0]),
          });
          return new Response(await upstream.text(), {
            status: upstream.status,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        } catch (error) {
          if (error instanceof SyntaxError || error instanceof z.ZodError) {
            return Response.json({ error: { code: -32600, message: "Invalid JSON-RPC request" } }, { status: 400 });
          }
          return Response.json(
            { error: { code: -32603, message: "Alchemy RPC request failed" } },
            { status: 502 },
          );
        }
      },
    },
  },
});
