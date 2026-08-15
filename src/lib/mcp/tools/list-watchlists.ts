import { defineTool, ToolError } from "@lovable.dev/mcp-js";

import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_watchlists",
  title: "List watchlists",
  description: "List the signed-in member's SOLIQ watchlists with the symbols tracked on each one.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const [lists, assets] = await Promise.all([
      supabase.from("watchlists").select("id, name, is_default, created_at").order("created_at"),
      supabase.from("watchlist_assets").select("watchlist_id, symbol, asset_kind, note"),
    ]);
    if (lists.error) throw new ToolError(lists.error.message);
    if (assets.error) throw new ToolError(assets.error.message);

    const rows = (lists.data ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      isDefault: l.is_default,
      symbols: (assets.data ?? [])
        .filter((a) => a.watchlist_id === l.id)
        .map((a) => ({ symbol: a.symbol, kind: a.asset_kind, note: a.note })),
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { watchlists: rows },
    };
  },
});
