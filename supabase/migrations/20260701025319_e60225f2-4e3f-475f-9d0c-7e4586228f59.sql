REVOKE ALL ON FUNCTION public.request_package_change(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_package_change(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_package_change(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_package_change(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_package_change(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_package_change(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.request_package_change(_user_id uuid, _to_package_id integer, _note text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cur_pkg int;
  cur_balance numeric;
  cur_active boolean;
  cur_price numeric;
  new_price numeric;
  diff numeric;
  has_pending boolean;
  new_id uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

  SELECT package_id, balance, is_active INTO cur_pkg, cur_balance, cur_active
  FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF cur_balance IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF NOT COALESCE(cur_active, false) OR cur_pkg IS NULL THEN RAISE EXCEPTION 'no_active_package'; END IF;
  IF cur_pkg = _to_package_id THEN RAISE EXCEPTION 'same_package'; END IF;

  SELECT price INTO new_price FROM public.packages WHERE id = _to_package_id;
  IF new_price IS NULL THEN RAISE EXCEPTION 'package_not_found'; END IF;
  SELECT price INTO cur_price FROM public.packages WHERE id = cur_pkg;

  diff := GREATEST(new_price - COALESCE(cur_price,0), 0);
  IF cur_balance < diff THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.package_change_requests
    WHERE user_id = _user_id AND status = 'pending') INTO has_pending;
  IF has_pending THEN RAISE EXCEPTION 'request_pending'; END IF;

  INSERT INTO public.package_change_requests(user_id, from_package_id, to_package_id, points_required, note)
  VALUES (_user_id, cur_pkg, _to_package_id, diff, _note)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.reject_package_change(_request_id uuid, _admin_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.package_change_requests
    SET status = 'rejected', admin_note = _admin_note
    WHERE id = _request_id AND status = 'pending';
END;
$function$;