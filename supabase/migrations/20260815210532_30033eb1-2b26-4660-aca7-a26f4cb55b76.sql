CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER subscriptions_touch_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Resolve the access tier a member is actually entitled to.
-- Access is granted while a plan is active/trialing/past_due (Stripe retries),
-- and a cancelled plan keeps access until the paid period ends.
CREATE OR REPLACE FUNCTION public.effective_tier(_user_id uuid)
RETURNS public.membership_tier
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
               WHEN s.price_id LIKE 'soliq_professional%' THEN 'elite'::public.membership_tier
               WHEN s.price_id LIKE 'soliq_pro%' THEN 'pro'::public.membership_tier
               ELSE 'free'::public.membership_tier
             END
      FROM public.subscriptions s
      WHERE s.user_id = _user_id
        AND (
          (s.status IN ('active', 'trialing', 'past_due')
            AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'canceled' AND s.current_period_end > now())
        )
      ORDER BY
        CASE WHEN s.price_id LIKE 'soliq_professional%' THEN 2 ELSE 1 END DESC,
        s.created_at DESC
      LIMIT 1
    ),
    (SELECT p.membership_tier FROM public.profiles p WHERE p.id = _user_id),
    'free'::public.membership_tier
  );
$$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.effective_tier(_user_id) <> 'free'::public.membership_tier;
$$;

CREATE OR REPLACE FUNCTION public.is_paid_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.effective_tier(_user_id) <> 'free'::public.membership_tier;
$$;

GRANT EXECUTE ON FUNCTION public.effective_tier(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated, service_role;