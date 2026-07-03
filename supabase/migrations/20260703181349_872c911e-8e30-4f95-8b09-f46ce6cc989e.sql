ALTER FUNCTION public.is_admin(uuid) SECURITY INVOKER;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;