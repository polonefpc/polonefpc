CREATE OR REPLACE FUNCTION public.request_package_purchase(_user_id uuid, _package_id int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pkg_price numeric;
  current_balance numeric;
  current_package int;
  has_pending boolean;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  SELECT price INTO pkg_price
  FROM public.packages
  WHERE id = _package_id;

  IF pkg_price IS NULL THEN
    RAISE EXCEPTION 'package_not_found';
  END IF;

  SELECT balance, package_id INTO current_balance, current_package
  FROM public.profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF current_package IS NOT NULL THEN
    RAISE EXCEPTION 'package_already_active';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.deposit_requests
    WHERE user_id = _user_id
      AND package_id IS NOT NULL
      AND status = 'pending'
  ) INTO has_pending;

  IF has_pending THEN
    RAISE EXCEPTION 'package_request_pending';
  END IF;

  IF current_balance < pkg_price THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  UPDATE public.profiles
  SET balance = balance - pkg_price
  WHERE id = _user_id;

  INSERT INTO public.deposit_requests(user_id, package_id, amount, tx_hash, note)
  VALUES (_user_id, _package_id, pkg_price, 'PKG-BUY', 'شراء باقة من السلة');
END;
$$;

REVOKE ALL ON FUNCTION public.request_package_purchase(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_package_purchase(uuid, int) TO service_role;