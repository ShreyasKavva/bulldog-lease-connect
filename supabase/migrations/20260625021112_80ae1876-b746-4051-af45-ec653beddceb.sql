
REVOKE EXECUTE ON FUNCTION public.notify_on_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_price_drop() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_listing_match() FROM PUBLIC, anon, authenticated;
