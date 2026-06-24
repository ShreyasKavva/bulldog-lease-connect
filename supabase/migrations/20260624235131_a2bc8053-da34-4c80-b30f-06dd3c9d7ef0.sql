
-- 1. Admin & ban flags on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false;

-- 2. Flagged column on listings (admin-marked unverified)
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT false;

-- 3. is_admin() helper (security definer, avoids RLS recursion on profiles)
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = _uid), false);
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- 4. Reports table
CREATE TABLE IF NOT EXISTS public.listing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open | dismissed | actioned
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listing_reports_status_idx ON public.listing_reports(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_reports TO authenticated;
GRANT ALL ON public.listing_reports TO service_role;

ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_insert_any_auth ON public.listing_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY reports_admin_read ON public.listing_reports
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY reports_admin_update ON public.listing_reports
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY reports_admin_delete ON public.listing_reports
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 5. Admin override policies on existing tables
CREATE POLICY listings_admin_update ON public.listings
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY listings_admin_delete ON public.listings
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
