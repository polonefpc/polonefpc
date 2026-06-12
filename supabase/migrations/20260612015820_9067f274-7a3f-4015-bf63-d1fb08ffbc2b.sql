
CREATE OR REPLACE FUNCTION public.process_transfer_points(_from_user uuid, _to_code text, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  receiver_id uuid;
  receiver_active boolean;
  sender_balance numeric;
  sender_active boolean;
BEGIN
  IF _from_user IS NULL THEN RAISE EXCEPTION 'sender_not_found'; END IF;
  IF _to_code !~ '^\d{5}$' THEN RAISE EXCEPTION 'invalid_account_id'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT balance, is_active INTO sender_balance, sender_active
  FROM public.profiles WHERE id = _from_user FOR UPDATE;
  IF sender_balance IS NULL THEN RAISE EXCEPTION 'sender_not_found'; END IF;
  IF NOT COALESCE(sender_active,false) THEN RAISE EXCEPTION 'sender_not_active'; END IF;

  SELECT id, is_active INTO receiver_id, receiver_active
  FROM public.profiles WHERE referral_code = _to_code;
  IF receiver_id IS NULL THEN RAISE EXCEPTION 'receiver_not_found'; END IF;
  IF receiver_id = _from_user THEN RAISE EXCEPTION 'self_transfer_not_allowed'; END IF;
  IF NOT COALESCE(receiver_active,false) THEN RAISE EXCEPTION 'receiver_not_active'; END IF;

  IF sender_balance < _amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  UPDATE public.profiles SET balance = balance - _amount WHERE id = _from_user;
  UPDATE public.profiles SET balance = balance + _amount WHERE id = receiver_id;
  INSERT INTO public.transfers(from_user, to_user, amount) VALUES (_from_user, receiver_id, _amount);
END;
$function$;
