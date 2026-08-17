DROP POLICY IF EXISTS "Paid members can post" ON public.community_posts;
CREATE POLICY "Paid members can post" ON public.community_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.user_id = auth.uid()
          AND (
            (s.status IN ('active', 'trialing', 'past_due')
              AND (s.current_period_end IS NULL OR s.current_period_end > now()))
            OR (s.status = 'canceled' AND s.current_period_end > now())
          )
          AND (s.price_id LIKE 'soliq_pro%' OR s.price_id LIKE 'soliq_professional%')
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.membership_tier <> 'free'::public.membership_tier
      )
    )
  );

REVOKE EXECUTE ON FUNCTION public.is_paid_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_paid_member(uuid) TO service_role;