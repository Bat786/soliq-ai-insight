import { useEffect, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Detects environments where mobile wallet deep links (universal links) cannot
 * fire: any iframe (Lovable's own preview panel) and known in-app browsers.
 * iOS blocks universal links from inside an iframe, so the wallet adapter times
 * out and falls back to "not installed" — the user just sees a download page.
 */
export function useEmbeddedBrowser(): { embedded: boolean; reason: "iframe" | "in-app-browser" | null } {
  const [state, setState] = useState<{ embedded: boolean; reason: "iframe" | "in-app-browser" | null }>({
    embedded: false,
    reason: null,
  });

  useEffect(() => {
    let framed = false;
    try {
      framed = window.self !== window.top;
    } catch {
      framed = true; // cross-origin access throws only when we are framed
    }
    const ua = navigator.userAgent;
    const inApp = /FBAN|FBAV|Instagram|Line\/|Twitter|TikTok|WebView|; wv\)/i.test(ua);
    setState({ embedded: framed || inApp, reason: framed ? "iframe" : inApp ? "in-app-browser" : null });
  }, []);

  return state;
}

/** Warning banner shown on wallet surfaces when deep links can't work. */
export function EmbeddedPreviewNotice({ className }: { className?: string }) {
  const { embedded, reason } = useEmbeddedBrowser();
  const [copied, setCopied] = useState(false);

  if (!embedded) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="status"
      className={cn(
        "panel flex flex-wrap items-center gap-2 border-primary/30 px-3 py-2 text-[11px] text-muted-foreground",
        className,
      )}
    >
      <ExternalLink className="size-3.5 shrink-0 text-primary" />
      <span className="text-foreground">Open this page in Safari or Chrome to connect your wallet.</span>
      <span>
        {reason === "iframe"
          ? "Embedded previews block wallet deep links, so connecting will fail here."
          : "In-app browsers block wallet deep links, so connecting will fail here."}
      </span>
      <Button size="sm" variant="subtle" className="ml-auto h-7 gap-1.5 px-2 text-[11px]" onClick={() => void copy()}>
        <Copy className="size-3" /> {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
