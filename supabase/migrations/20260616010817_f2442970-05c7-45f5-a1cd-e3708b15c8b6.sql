
-- 1) help_sections
CREATE TABLE public.help_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  video_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.help_sections TO anon, authenticated;
GRANT ALL ON public.help_sections TO service_role;
ALTER TABLE public.help_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_sections_public_read" ON public.help_sections FOR SELECT USING (true);
CREATE POLICY "help_sections_admin_all" ON public.help_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_help_sections_updated BEFORE UPDATE ON public.help_sections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) package_change_requests
CREATE TABLE public.package_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_package_id int REFERENCES public.packages(id),
  to_package_id int NOT NULL REFERENCES public.packages(id),
  points_required numeric NOT NULL DEFAULT 0,
  note text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.package_change_requests TO authenticated;
GRANT ALL ON public.package_change_requests TO service_role;
ALTER TABLE public.package_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcr_owner_select" ON public.package_change_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pcr_owner_insert" ON public.package_change_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "pcr_admin_update" ON public.package_change_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_pcr_updated BEFORE UPDATE ON public.package_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) RPC: request_package_change
CREATE OR REPLACE FUNCTION public.request_package_change(_user_id uuid, _to_package_id int, _note text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
END $$;

-- 4) RPC: approve_package_change
CREATE OR REPLACE FUNCTION public.approve_package_change(_request_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  cur_balance numeric;
BEGIN
  SELECT * INTO r FROM public.package_change_requests WHERE id = _request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'request_not_pending'; END IF;

  SELECT balance INTO cur_balance FROM public.profiles WHERE id = r.user_id FOR UPDATE;
  IF cur_balance < r.points_required THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  UPDATE public.profiles
    SET balance = balance - r.points_required,
        package_id = r.to_package_id,
        activated_at = now(),
        is_active = true
    WHERE id = r.user_id;

  UPDATE public.package_change_requests SET status = 'approved' WHERE id = _request_id;
END $$;

-- 5) RPC: reject_package_change
CREATE OR REPLACE FUNCTION public.reject_package_change(_request_id uuid, _admin_note text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.package_change_requests
    SET status = 'rejected', admin_note = _admin_note
    WHERE id = _request_id AND status = 'pending';
END $$;
