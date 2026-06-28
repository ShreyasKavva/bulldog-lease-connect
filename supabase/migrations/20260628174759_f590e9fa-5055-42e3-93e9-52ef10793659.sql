
ALTER VIEW public.suspicious_listings SET (security_invoker = true);
ALTER VIEW public.suspicious_listings_filtered SET (security_invoker = true);
ALTER VIEW public.user_risk_scores SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.compute_verification_tier(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_verification_tier_after() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.score_and_hide_report() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_approve_pending_listings() FROM PUBLIC, anon, authenticated;
