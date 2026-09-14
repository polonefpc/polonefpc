REVOKE EXECUTE ON FUNCTION public.admin_delete_package(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_sync_referral_count() FROM anon, authenticated;