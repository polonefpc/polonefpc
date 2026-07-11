
CREATE TABLE IF NOT EXISTS public.referral_milestone_claims (
  user_id uuid PRIMARY KEY,
  amount numeric NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_milestone_claims TO authenticated;
GRANT ALL ON public.referral_milestone_claims TO service_role;
ALTER TABLE public.referral_milestone_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own claims read" ON public.referral_milestone_claims
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_referral_milestone()
RETURNS TABLE(ok boolean, amount numeric, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rc int;
  already boolean;
  reward numeric := 94;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT false, 0::numeric, 'unauthenticated'::text; RETURN;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.referral_milestone_claims WHERE user_id = uid) INTO already;
  IF already THEN
    RETURN QUERY SELECT false, 0::numeric, 'already_claimed'::text; RETURN;
  END IF;

  SELECT GREATEST(COALESCE(referral_count,0),
                  (SELECT count(*)::int FROM public.profiles WHERE referred_by = uid))
  INTO rc FROM public.profiles WHERE id = uid;

  IF COALESCE(rc,0) < 10 THEN
    RETURN QUERY SELECT false, 0::numeric, 'not_enough_referrals'::text; RETURN;
  END IF;

  UPDATE public.profiles SET balance = COALESCE(balance,0) + reward WHERE id = uid;
  INSERT INTO public.referral_milestone_claims(user_id, amount) VALUES (uid, reward);

  RETURN QUERY SELECT true, reward, 'ok'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_referral_milestone() TO authenticated;
