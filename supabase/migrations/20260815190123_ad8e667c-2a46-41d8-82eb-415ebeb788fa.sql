CREATE TABLE public.broker_provider_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'snaptrade',
  provider_user_id text NOT NULL,
  provider_user_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

GRANT ALL ON public.broker_provider_secrets TO service_role;

ALTER TABLE public.broker_provider_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to broker provider secrets"
  ON public.broker_provider_secrets FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_broker_provider_secrets_updated_at
  BEFORE UPDATE ON public.broker_provider_secrets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();