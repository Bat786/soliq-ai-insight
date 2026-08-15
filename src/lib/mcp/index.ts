import { auth, defineMcp } from "@lovable.dev/mcp-js";

import createAlertTool from "./tools/create-alert";
import getPortfolioTool from "./tools/get-portfolio";
import listAlertsTool from "./tools/list-alerts";
import listWatchlistsTool from "./tools/list-watchlists";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged, and Vite inlines it at build time.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "soliq-ai-insights",
  title: "SOLIQ AI Insights",
  version: "0.1.0",
  instructions:
    "Tools for SOLIQ, an AI market intelligence and investing platform. Use `list_watchlists` and `get_portfolio` " +
    "to read the member's tracked symbols and holdings, `list_alerts` to review armed price alerts, and " +
    "`create_alert` to arm a new price alert. All tools act as the signed-in SOLIQ member.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listWatchlistsTool, listAlertsTool, createAlertTool, getPortfolioTool],
});
