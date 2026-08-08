REVOKE EXECUTE ON FUNCTION public.agent_grant_points(uuid, text, numeric) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.agent_grant_points(uuid, text, numeric) TO service_role;