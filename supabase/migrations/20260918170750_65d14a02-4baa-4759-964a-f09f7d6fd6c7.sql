GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;

GRANT SELECT ON public.tour_availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tour_availability TO authenticated;
GRANT ALL ON public.tour_availability TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.tour_bookings TO authenticated;
GRANT ALL ON public.tour_bookings TO service_role;