CREATE OR REPLACE FUNCTION public.is_paid_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
    ELSE public.effective_tier(_user_id) <> 'free'::public.membership_tier
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_paid_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_paid_member(uuid) TO authenticated, service_role;