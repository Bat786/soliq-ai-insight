CREATE TABLE public.bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'plaid',
  item_id text NOT NULL,
  institution_id text,
  institution_name text,
  access_token text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, item_id)
);

-- Access tokens are provider credentials: service role only, no client access.
GRANT ALL ON public.bank_connections TO service_role;
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to bank connections" ON public.bank_connections
  FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX bank_connections_user_idx ON public.bank_connections (user_id);
CREATE TRIGGER bank_connections_touch BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  provider_account_id text NOT NULL,
  institution_name text,
  account_name text,
  official_name text,
  mask text,
  account_type text,
  account_subtype text,
  currency text NOT NULL DEFAULT 'USD',
  available_balance numeric,
  current_balance numeric,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_account_id)
);

GRANT SELECT ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read their own bank accounts" ON public.bank_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX bank_accounts_user_idx ON public.bank_accounts (user_id);
CREATE TRIGGER bank_accounts_touch BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();