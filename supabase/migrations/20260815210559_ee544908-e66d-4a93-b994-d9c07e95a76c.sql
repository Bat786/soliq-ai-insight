REVOKE EXECUTE ON FUNCTION public.effective_tier(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_paid_member(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.effective_tier(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_paid_member(uuid) TO authenticated, service_role;