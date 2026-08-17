-- 1. Paid membership helper: only self (or backend) may be inspected.
CREATE OR REPLACE FUNCTION public.is_paid_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    WHEN auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN false
    ELSE public.effective_tier(_user_id) <> 'free'::public.membership_tier
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_paid_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_paid_member(uuid) TO authenticated, service_role;

-- 2. bank_accounts: read-only for members, writes only via service role.
REVOKE INSERT, UPDATE, DELETE ON public.bank_accounts FROM authenticated, anon;
GRANT SELECT ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;

-- 3. System-synced financial tables: SELECT-only for members.
DROP POLICY IF EXISTS "Users manage their own broker accounts" ON public.broker_accounts;
CREATE POLICY "Members read their own broker accounts" ON public.broker_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own broker positions" ON public.broker_positions;
CREATE POLICY "Members read their own broker positions" ON public.broker_positions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own broker transactions" ON public.broker_transactions;
CREATE POLICY "Members read their own broker transactions" ON public.broker_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own wallet holdings" ON public.wallet_holdings;
CREATE POLICY "Members read their own wallet holdings" ON public.wallet_holdings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Members read their own wallet transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON
  public.broker_accounts, public.broker_positions, public.broker_transactions,
  public.wallet_holdings, public.wallet_transactions
  FROM authenticated, anon;

GRANT SELECT ON
  public.broker_accounts, public.broker_positions, public.broker_transactions,
  public.wallet_holdings, public.wallet_transactions
  TO authenticated;

GRANT ALL ON
  public.broker_accounts, public.broker_positions, public.broker_transactions,
  public.wallet_holdings, public.wallet_transactions
  TO service_role;