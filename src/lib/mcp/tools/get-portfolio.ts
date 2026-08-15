import { defineTool, ToolError } from "@lovable.dev/mcp-js";

import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_portfolio",
  title: "Get portfolio",
  description: "Return the signed-in member's SOLIQ portfolios and their current positions.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const [portfolios, positions] = await Promise.all([
      supabase.from("portfolios").select("id, name, base_currency, origin, created_at").order("created_at"),
      supabase.from("portfolio_positions").select("*"),
    ]);
    if (portfolios.error) throw new ToolError(portfolios.error.message);
    if (positions.error) throw new ToolError(positions.error.message);

    const rows = (portfolios.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      currency: p.base_currency,
      origin: p.origin,
      positions: (positions.data ?? []).filter(
        (pos) => (pos as { portfolio_id?: string }).portfolio_id === p.id,
      ),
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { portfolios: rows },
    };
  },
});
