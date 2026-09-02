
INSERT INTO public.settings(key, value) VALUES
  ('welcome_bonus_enabled','true'),
  ('welcome_bonus_amount','25'),
  ('referral_offer_enabled','true'),
  ('referral_offer_goal','10'),
  ('referral_offer_reward','94'),
  ('referral_offer_title','ادعُ 10 أشخاص واربح 94 USDT')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ref_id uuid;
  ref_input text;
  new_code text;
  admin_email text := 'mooh2000mooh2026@gmail.com';
  bonus numeric := 0;
BEGIN
  ref_input := COALESCE(NEW.raw_user_meta_data->>'ref_code', NEW.raw_user_meta_data->>'ref');
  IF ref_input IS NOT NULL AND ref_input <> '' THEN
    SELECT id INTO ref_id FROM public.profiles WHERE referral_code = ref_input;
    IF ref_id IS NULL THEN
      BEGIN ref_id := ref_input::uuid; EXCEPTION WHEN others THEN ref_id := NULL; END;
    END IF;
  END IF;

  new_code := public.gen_referral_code();

  IF COALESCE((SELECT value FROM public.settings WHERE key = 'welcome_bonus_enabled'), 'false') = 'true' THEN
    BEGIN
      bonus := COALESCE((SELECT value FROM public.settings WHERE key = 'welcome_bonus_amount'), '0')::numeric;
    EXCEPTION WHEN others THEN bonus := 0;
    END;
  END IF;

  INSERT INTO public.profiles(id,email,full_name,referred_by,referral_code,balance)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', ref_id, new_code, GREATEST(COALESCE(bonus,0),0));

  IF ref_id IS NOT NULL THEN
    UPDATE public.profiles SET referral_count = referral_count + 1 WHERE id = ref_id;
  END IF;

  IF NEW.email = admin_email THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.claim_referral_milestone()
RETURNS TABLE(ok boolean, amount numeric, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  rc int;
  already boolean;
  goal int := 10;
  reward numeric := 94;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT false, 0::numeric, 'unauthenticated'::text; RETURN;
  END IF;

  IF COALESCE((SELECT value FROM public.settings WHERE key = 'referral_offer_enabled'), 'true') <> 'true' THEN
    RETURN QUERY SELECT false, 0::numeric, 'offer_disabled'::text; RETURN;
  END IF;

  BEGIN
    goal := COALESCE((SELECT value FROM public.settings WHERE key = 'referral_offer_goal'), '10')::int;
    reward := COALESCE((SELECT value FROM public.settings WHERE key = 'referral_offer_reward'), '94')::numeric;
  EXCEPTION WHEN others THEN goal := 10; reward := 94;
  END;

  SELECT EXISTS(SELECT 1 FROM public.referral_milestone_claims WHERE user_id = uid) INTO already;
  IF already THEN
    RETURN QUERY SELECT false, 0::numeric, 'already_claimed'::text; RETURN;
  END IF;

  SELECT GREATEST(COALESCE(referral_count,0),
                  (SELECT count(*)::int FROM public.profiles WHERE referred_by = uid))
  INTO rc FROM public.profiles WHERE id = uid;

  IF COALESCE(rc,0) < goal THEN
    RETURN QUERY SELECT false, 0::numeric, 'not_enough_referrals'::text; RETURN;
  END IF;

  UPDATE public.profiles SET balance = COALESCE(balance,0) + reward WHERE id = uid;
  INSERT INTO public.referral_milestone_claims(user_id, amount) VALUES (uid, reward);

  RETURN QUERY SELECT true, reward, 'ok'::text;
END;
$function$;
