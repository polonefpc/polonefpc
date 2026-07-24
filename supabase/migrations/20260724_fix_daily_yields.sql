-- Fix daily yields function to properly add points to user balances
-- Problem: Previous versions had conflicting conditions and NULL checks
-- Solution: Simplified logic with proper COALESCE handling

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
  -- Get all eligible users:
  -- - is_active = true
  -- - has a package assigned
  -- - referral_count (for extra points)
  -- - hasn't received daily yield today yet
  FOR u IN
    SELECT 
      p.id, 
      COALESCE(p.referral_count, 0) AS referral_count, 
      COALESCE(pkg.daily_rate, 0) AS daily_rate,
      COALESCE(p.balance, 0) AS current_balance
    FROM public.profiles p
    LEFT JOIN public.packages pkg ON pkg.id = p.package_id
    WHERE 
      p.is_active = true
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
    -- Calculate total increment: daily_rate + bonus from referrals (0.5 per referral)
    inc := u.daily_rate + (u.referral_count * 0.5);

    -- Update user balance: add the calculated increment
    UPDATE public.profiles
    SET 
      balance = COALESCE(balance, 0) + inc,
      updated_at = now(),
      activated_at = COALESCE(activated_at, now())
    WHERE id = u.id;

    -- Log this daily yield transaction for tracking
    INSERT INTO public.daily_yields(user_id, amount, rate, applied_on)
    VALUES (u.id, inc, u.daily_rate, _apply_date);

    processed := processed + 1;
  END LOOP;

  RETURN processed;
END;
$function$;

-- Revoke public access, only service_role can execute
REVOKE ALL ON FUNCTION public.apply_daily_yields(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_daily_yields(date) TO service_role;
