import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_alert",
  title: "Create price alert",
  description: "Arm a SOLIQ price alert for a symbol that fires when price crosses above or below a threshold.",
  inputSchema: {
    symbol: z.string().trim().min(1).max(24).describe("Ticker or token symbol, e.g. SOL or NVDA."),
    direction: z.enum(["above", "below"]).describe("Fire when price crosses above or below the threshold."),
    threshold: z.number().positive().describe("Trigger price in USD."),
    listName: z.string().trim().min(1).max(80).optional().describe("Watchlist to attach the alert to."),
    assetId: z.string().trim().min(1).max(80).optional().describe("SOLIQ asset id, when known."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ symbol, direction, threshold, listName, assetId }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const ticker = symbol.toUpperCase();
    const { data, error } = await supabase
      .from("watchlist_alerts")
      .insert({
        user_id: ctx.getUserId(),
        list_name: listName ?? "Watchlist",
        asset_id: assetId ?? ticker.toLowerCase(),
        asset_symbol: ticker,
        direction,
        threshold,
      })
      .select("id, list_name, asset_symbol, direction, threshold, active, created_at")
      .single();
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: `Alert armed: ${ticker} ${direction} ${threshold}` }],
      structuredContent: { alert: data },
    };
  },
});
