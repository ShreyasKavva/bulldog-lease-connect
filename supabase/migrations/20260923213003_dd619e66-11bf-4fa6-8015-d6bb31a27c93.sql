ALTER VIEW public.profiles_public SET (security_invoker = false);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profiles_public FROM authenticated;