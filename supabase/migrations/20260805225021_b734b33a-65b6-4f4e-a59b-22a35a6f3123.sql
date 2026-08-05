CREATE OR REPLACE FUNCTION public.is_paid_member(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND membership_tier IN ('pro', 'elite')
  )
$$;