ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS package_type text NOT NULL DEFAULT 'عقد إلكتروني';

CREATE SEQUENCE IF NOT EXISTS public.packages_id_seq;
SELECT setval(
  'public.packages_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM public.packages), 0), 1),
  true
);
ALTER SEQUENCE public.packages_id_seq OWNED BY public.packages.id;
ALTER TABLE public.packages ALTER COLUMN id SET DEFAULT nextval('public.packages_id_seq');

GRANT SELECT ON public.packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.packages_id_seq TO authenticated, service_role;

DROP POLICY IF EXISTS "admin manage packages" ON public.packages;
CREATE POLICY "admin manage packages"
ON public.packages
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.apply_daily_yields(_apply_date date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  processed integer := 0;
BEGIN
  WITH eligible AS (
    SELECT
      p.id AS user_id,
      pkg.daily_rate::numeric AS amount
    FROM public.profiles p
    INNER JOIN public.packages pkg ON pkg.id = p.package_id
    WHERE p.is_active IS TRUE
      AND p.package_id IS NOT NULL
      AND pkg.daily_rate > 0
  ), inserted AS (
    INSERT INTO public.daily_yields (user_id, amount, rate, applied_on)
    SELECT e.user_id, e.amount, e.amount, _apply_date
    FROM eligible e
    ON CONFLICT (user_id, applied_on) DO NOTHING
    RETURNING user_id, amount
  ), credited AS (
    UPDATE public.profiles p
    SET balance = COALESCE(p.balance, 0) + i.amount,
        activated_at = COALESCE(p.activated_at, now())
    FROM inserted i
    WHERE p.id = i.user_id
    RETURNING p.id
  )
  SELECT count(*)::integer INTO processed FROM credited;

  RETURN processed;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_daily_yields(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_daily_yields(date) TO service_role;

COMMENT ON FUNCTION public.apply_daily_yields(date) IS
'Credits each active account its package daily_rate exactly once for the supplied date.';