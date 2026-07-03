CREATE OR REPLACE FUNCTION public.apply_daily_yields(_apply_date date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  processed integer := 0;
  u record;
  inc numeric;
BEGIN
  FOR u IN
    SELECT p.id, COALESCE(p.referral_count, 0) AS referral_count, COALESCE(pkg.daily_rate, 0) AS daily_rate
    FROM public.profiles p
    JOIN public.packages pkg ON pkg.id = p.package_id
    WHERE COALESCE(p.is_active, false) = true
      AND p.package_id IS NOT NULL
      AND COALESCE(pkg.daily_rate, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.daily_yields dy
        WHERE dy.user_id = p.id
          AND dy.applied_on = _apply_date
      )
    FOR UPDATE OF p
  LOOP
    inc := u.daily_rate + (u.referral_count * 0.5);

    UPDATE public.profiles
    SET balance = COALESCE(balance, 0) + inc,
        activated_at = COALESCE(activated_at, now())
    WHERE id = u.id;

    INSERT INTO public.daily_yields(user_id, amount, rate, applied_on)
    VALUES (u.id, inc, u.daily_rate, _apply_date);

    processed := processed + 1;
  END LOOP;

  RETURN processed;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_daily_yields(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_daily_yields(date) TO service_role;