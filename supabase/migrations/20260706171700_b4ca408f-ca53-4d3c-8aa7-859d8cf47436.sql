ALTER TABLE public.roommate_profiles ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'looking';
ALTER TABLE public.roommate_profiles DROP CONSTRAINT IF EXISTS roommate_profiles_mode_check;
ALTER TABLE public.roommate_profiles ADD CONSTRAINT roommate_profiles_mode_check CHECK (mode IN ('has_room','looking'));
CREATE INDEX IF NOT EXISTS roommate_profiles_mode_idx ON public.roommate_profiles(mode);