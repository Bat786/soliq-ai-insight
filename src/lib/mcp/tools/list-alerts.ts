import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_alerts",
  title: "List price alerts",
  description: "List the signed-in member's SOLIQ price alerts, newest first.",
  inputSchema: {
    activeOnly: z.boolean().optional().describe("Only return alerts that are still armed."),
    limit: z.number().int().min(1).max(100).optional().describe("Maximum number of alerts to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ activeOnly, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("watchlist_alerts")
      .select("id, list_name, asset_symbol, direction, threshold, active, last_triggered_at, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (activeOnly) query = query.eq("active", true);

    const { data, error } = await query;
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { alerts: data ?? [] },
    };
  },
});
