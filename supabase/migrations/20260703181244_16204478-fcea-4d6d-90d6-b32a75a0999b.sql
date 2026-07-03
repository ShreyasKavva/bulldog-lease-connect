GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT INSERT ON TABLE public.profiles TO authenticated;
GRANT UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.profiles TO service_role;

GRANT SELECT ON TABLE public.profiles_public TO anon;
GRANT SELECT ON TABLE public.profiles_public TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.profiles_public TO service_role;