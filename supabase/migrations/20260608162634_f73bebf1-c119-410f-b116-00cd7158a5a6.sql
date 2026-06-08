CREATE OR REPLACE FUNCTION public.apply_daily_yields(_apply_date date DEFAULT current_date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  processed integer := 0;
  u record;
  inc numeric;
BEGIN
  FOR u IN
    SELECT p.id, p.balance, p.referral_count, pkg.daily_rate
    FROM public.profiles p
    JOIN public.packages pkg ON pkg.id = p.package_id
    WHERE p.is_active = true
      AND p.package_id IS NOT NULL
      AND p.activated_at IS NOT NULL
      AND p.activated_at <= now() - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.daily_yields dy
        WHERE dy.user_id = p.id AND dy.applied_on = _apply_date
      )
    FOR UPDATE OF p
  LOOP
    inc := COALESCE(u.daily_rate, 0) + (COALESCE(u.referral_count, 0) * 0.5);

    UPDATE public.profiles
    SET balance = balance + inc
    WHERE id = u.id;

    INSERT INTO public.daily_yields(user_id, amount, rate, applied_on)
    VALUES (u.id, inc, COALESCE(u.daily_rate, 0), _apply_date);

    processed := processed + 1;
  END LOOP;

  RETURN processed;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_daily_yields(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_daily_yields(date) TO service_role;

CREATE OR REPLACE FUNCTION public.process_transfer_points(_from_user uuid, _to_code text, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  receiver_id uuid;
  sender_balance numeric;
BEGIN
  IF _from_user IS NULL THEN
    RAISE EXCEPTION 'sender_not_found';
  END IF;

  IF _to_code !~ '^\d{5}$' THEN
    RAISE EXCEPTION 'invalid_account_id';
  END IF;

  IF _amount IS NULL OR _amount <= 0 OR _amount > 40 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT id INTO receiver_id
  FROM public.profiles
  WHERE referral_code = _to_code;

  IF receiver_id IS NULL THEN
    RAISE EXCEPTION 'receiver_not_found';
  END IF;

  IF receiver_id = _from_user THEN
    RAISE EXCEPTION 'self_transfer_not_allowed';
  END IF;

  SELECT balance INTO sender_balance
  FROM public.profiles
  WHERE id = _from_user
  FOR UPDATE;

  IF sender_balance IS NULL THEN
    RAISE EXCEPTION 'sender_not_found';
  END IF;

  IF sender_balance < _amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  UPDATE public.profiles
  SET balance = balance - _amount
  WHERE id = _from_user;

  UPDATE public.profiles
  SET balance = balance + _amount
  WHERE id = receiver_id;

  INSERT INTO public.transfers(from_user, to_user, amount)
  VALUES (_from_user, receiver_id, _amount);
END;
$$;

REVOKE ALL ON FUNCTION public.process_transfer_points(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_transfer_points(uuid, text, numeric) TO service_role;