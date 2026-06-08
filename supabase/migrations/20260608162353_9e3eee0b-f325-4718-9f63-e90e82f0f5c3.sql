CREATE OR REPLACE FUNCTION public.transfer_points_by_code(_to_code text, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_id uuid := auth.uid();
  receiver_id uuid;
  sender_balance numeric;
BEGIN
  IF sender_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
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

  IF receiver_id = sender_id THEN
    RAISE EXCEPTION 'self_transfer_not_allowed';
  END IF;

  SELECT balance INTO sender_balance
  FROM public.profiles
  WHERE id = sender_id
  FOR UPDATE;

  IF sender_balance IS NULL THEN
    RAISE EXCEPTION 'sender_not_found';
  END IF;

  IF sender_balance < _amount THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  UPDATE public.profiles
  SET balance = balance - _amount
  WHERE id = sender_id;

  UPDATE public.profiles
  SET balance = balance + _amount
  WHERE id = receiver_id;

  INSERT INTO public.transfers(from_user, to_user, amount)
  VALUES (sender_id, receiver_id, _amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_points_by_code(text, numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_points_by_code(text, numeric) FROM anon;