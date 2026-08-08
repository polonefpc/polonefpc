CREATE OR REPLACE FUNCTION public.agent_grant_points(_agent_id uuid, _to_code text, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_agent boolean;
  agent_bal numeric;
  target_id uuid;
BEGIN
  IF _agent_id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _agent_id AND role IN ('agent','admin')) INTO is_agent;
  IF NOT is_agent THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT balance INTO agent_bal FROM public.agent_balances WHERE user_id = _agent_id FOR UPDATE;
  IF agent_bal IS NULL THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  IF agent_bal < _amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT id INTO target_id FROM public.profiles WHERE referral_code = _to_code;
  IF target_id IS NULL THEN
    BEGIN
      SELECT id INTO target_id FROM public.profiles WHERE id = _to_code::uuid;
    EXCEPTION WHEN others THEN target_id := NULL;
    END;
  END IF;
  IF target_id IS NULL THEN RAISE EXCEPTION 'receiver_not_found'; END IF;
  IF target_id = _agent_id THEN RAISE EXCEPTION 'self_transfer_not_allowed'; END IF;

  UPDATE public.agent_balances SET balance = balance - _amount, updated_at = now() WHERE user_id = _agent_id;
  UPDATE public.profiles SET balance = COALESCE(balance,0) + _amount WHERE id = target_id;
  INSERT INTO public.agent_grants(agent_id, to_user, amount) VALUES (_agent_id, target_id, _amount);
END;
$$;