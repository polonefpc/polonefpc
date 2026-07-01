-- Fix withdrawal/transfer amount checks while keeping old historical rows
ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS withdrawals_amount_check;
ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS السحب_المبلغ_التحقق;
ALTER TABLE public.withdrawals ADD CONSTRAINT withdrawals_amount_min_49_check CHECK (amount >= 49) NOT VALID;

ALTER TABLE public.transfers DROP CONSTRAINT IF EXISTS transfers_amount_check;
ALTER TABLE public.transfers ADD CONSTRAINT transfers_amount_positive_check CHECK (amount > 0) NOT VALID;

-- Let referrers view accounts created with their referral code so counts/lists work in the app
DROP POLICY IF EXISTS "referrer sees referred profiles" ON public.profiles;
CREATE POLICY "referrer sees referred profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (referred_by = auth.uid());

-- Daily yield: active accounts with active package only; one application per user per day
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
    SELECT p.id, p.referral_count, pkg.daily_rate
    FROM public.profiles p
    JOIN public.packages pkg ON pkg.id = p.package_id
    WHERE p.is_active = true
      AND p.package_id IS NOT NULL
      AND p.activated_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.daily_yields dy
        WHERE dy.user_id = p.id
          AND dy.applied_on = _apply_date
      )
    FOR UPDATE OF p
  LOOP
    inc := COALESCE(u.daily_rate, 0) + (COALESCE(u.referral_count, 0) * 0.5);

    IF inc > 0 THEN
      UPDATE public.profiles
      SET balance = balance + inc
      WHERE id = u.id;

      INSERT INTO public.daily_yields(user_id, amount, rate, applied_on)
      VALUES (u.id, inc, COALESCE(u.daily_rate, 0), _apply_date);

      processed := processed + 1;
    END IF;
  END LOOP;

  RETURN processed;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_daily_yields(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_daily_yields(date) TO service_role;

-- Package change approval: deduct the current difference at approval time based on current package prices
CREATE OR REPLACE FUNCTION public.approve_package_change(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  cur_balance numeric;
  cur_pkg int;
  cur_price numeric;
  new_price numeric;
  diff numeric;
BEGIN
  SELECT * INTO r FROM public.package_change_requests WHERE id = _request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'request_not_pending'; END IF;

  SELECT balance, package_id INTO cur_balance, cur_pkg FROM public.profiles WHERE id = r.user_id FOR UPDATE;
  IF cur_balance IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

  SELECT price INTO cur_price FROM public.packages WHERE id = cur_pkg;
  SELECT price INTO new_price FROM public.packages WHERE id = r.to_package_id;
  IF new_price IS NULL THEN RAISE EXCEPTION 'package_not_found'; END IF;

  diff := GREATEST(COALESCE(new_price, 0) - COALESCE(cur_price, 0), 0);
  IF cur_balance < diff THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  UPDATE public.profiles
    SET balance = balance - diff,
        package_id = r.to_package_id,
        activated_at = now(),
        is_active = true
    WHERE id = r.user_id;

  UPDATE public.package_change_requests
    SET status = 'approved', points_required = diff
    WHERE id = _request_id;
END;
$function$;