import { Link } from "@tanstack/react-router";
import { Bell, BellRing, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/use-soliq-account";

function timeAgo(iso: string) {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

export function NotificationBell() {
  const { items, unread, markRead, isSignedIn } = useNotifications();

  if (!isSignedIn) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Alerts (${unread} unread)`}>
          {unread > 0 ? <BellRing className="size-4.5 text-primary" /> : <Bell className="size-4.5" />}
          {unread > 0 && (
            <span className="num absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="text-sm font-medium">Alert notifications</p>
          {unread > 0 && (
            <button
              onClick={() => markRead.mutate()}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <Check className="size-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              No alerts yet.
              <br />
              <Link to="/lists" className="text-primary">
                Set a watchlist alert →
              </Link>
            </div>
          )}
          {items.map((n) => (
            <div
              key={n.id}
              className={`border-b border-border/60 px-3 py-3 last:border-0 ${n.read ? "" : "bg-primary/5"}`}
            >
              <p className="text-sm font-medium">{n.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{n.body}</p>
              <p className="num mt-1.5 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</p>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
