ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.manual_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  package_id integer REFERENCES public.packages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_referrals TO authenticated;
GRANT ALL ON public.manual_referrals TO service_role;

ALTER TABLE public.manual_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own manual referrals read" ON public.manual_referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin manage manual referrals" ON public.manual_referrals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.tg_sync_referral_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target uuid := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  UPDATE public.profiles p
  SET referral_count = (
    (SELECT count(*) FROM public.profiles r WHERE r.referred_by = target)
    + (SELECT count(*) FROM public.manual_referrals m WHERE m.user_id = target)
  )
  WHERE p.id = target;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_manual_referrals_sync ON public.manual_referrals;
CREATE TRIGGER trg_manual_referrals_sync
AFTER INSERT OR DELETE ON public.manual_referrals
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_referral_count();

CREATE OR REPLACE FUNCTION public.admin_delete_package(_id integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  BEGIN
    DELETE FROM public.packages WHERE id = _id;
    RETURN 'deleted';
  EXCEPTION WHEN foreign_key_violation THEN
    UPDATE public.packages SET is_visible = false WHERE id = _id;
    RETURN 'hidden';
  END;
END;
$$;