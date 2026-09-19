ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles SET verified_email = true WHERE verified_email = false AND lower(email) LIKE '%.edu';
ALTER TABLE public.profiles ENABLE TRIGGER USER;