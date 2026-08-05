import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

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

/** Notification feed plus a poller that evaluates watchlist alerts. */
export function useNotifications() {
  const { isSignedIn } = useSession();
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

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await runEvaluate({});
        if (!cancelled && res.triggered > 0) {
          await queryClient.invalidateQueries({ queryKey: ["notifications"] });
          await queryClient.invalidateQueries({ queryKey: ["alerts"] });
        }
      } catch {
        /* alert evaluation is best-effort */
      }
    };
    void tick();
    const id = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isSignedIn, runEvaluate, queryClient]);

  const markRead = useMutation({
    mutationFn: () => runMarkRead({}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = query.data ?? [];
  return { items, unread: items.filter((n) => !n.read).length, markRead, isSignedIn };
}
