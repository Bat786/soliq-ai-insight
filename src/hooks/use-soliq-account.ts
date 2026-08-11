import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, listNotifications, evaluateAlerts, markNotificationsRead } from "@/lib/soliq.functions";
import type { Tier } from "@/lib/membership";


/** Live Supabase session state for the browser. */
export function useSession() {
  const [session, setSession] = useState<{ userId: string; email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ? { userId: data.session.user.id, email: data.session.user.email ?? null } : null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ? { userId: s.user.id, email: s.user.email ?? null } : null);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, isSignedIn: !!session };
}

export function useProfile() {
  const { isSignedIn } = useSession();
  const fetchProfile = useServerFn(getMyProfile);
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
    enabled: isSignedIn,
  });
  return {
    ...query,
    tier: (query.data?.membership_tier ?? "free") as Tier,
    isSignedIn,
  };
}

const PUSH_KEY = "soliq.push.enabled";

export function usePushPermission() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
    setEnabled(localStorage.getItem(PUSH_KEY) === "1" && Notification.permission === "granted");
  }, []);

  const request = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    const result = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    setPermission(result);
    const ok = result === "granted";
    localStorage.setItem(PUSH_KEY, ok ? "1" : "0");
    setEnabled(ok);
    return ok;
  };

  const disable = () => {
    localStorage.setItem(PUSH_KEY, "0");
    setEnabled(false);
  };

  return { permission, enabled, request, disable, supported: permission !== "unsupported" };
}

function pushNotify(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted" || localStorage.getItem(PUSH_KEY) !== "1") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag: title });
  } catch {
    /* notification delivery is best-effort */
  }
}

/** Notification feed with realtime delivery plus a fast alert evaluator. */
export function useNotifications() {
  const { isSignedIn, session } = useSession();
  const queryClient = useQueryClient();
  const fetchNotifications = useServerFn(listNotifications);
  const runEvaluate = useServerFn(evaluateAlerts);
  const runMarkRead = useServerFn(markNotificationsRead);

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    enabled: isSignedIn,
    refetchInterval: 60_000,
  });

  // Realtime: new notification rows land instantly, no polling delay.
  useEffect(() => {
    const userId = session?.userId;
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { title?: string; body?: string };
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["alerts"] });
          toast.info(row.title ?? "Alert triggered", { description: row.body });
          pushNotify(row.title ?? "AETHRON alert triggered", row.body ?? "");
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.userId, queryClient]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    const tick = async () => {
      try {
        await runEvaluate({});
      } catch {
        /* alert evaluation is best-effort */
      }
    };
    void tick();
    const id = setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      void cancelled;
    };
  }, [isSignedIn, runEvaluate]);

  const markRead = useMutation({
    mutationFn: () => runMarkRead({}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = query.data ?? [];
  return { items, unread: items.filter((n) => !n.read).length, markRead, isSignedIn };
}

