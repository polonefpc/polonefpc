
-- 1) Add referral_code (5 digits) to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE c TEXT;
BEGIN
  LOOP
    c := lpad((floor(random()*100000))::int::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = c);
  END LOOP;
  RETURN c;
END $$;

-- Backfill existing rows
UPDATE public.profiles SET referral_code = public.gen_referral_code() WHERE referral_code IS NULL;

ALTER TABLE public.profiles ALTER COLUMN referral_code SET NOT NULL;

-- 2) Replace handle_new_user: support ref code lookup + auto-generate code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ref_id uuid;
  ref_input text;
  new_code text;
  admin_email text := 'mooh2000mooh2026@gmail.com';
BEGIN
  ref_input := COALESCE(NEW.raw_user_meta_data->>'ref_code', NEW.raw_user_meta_data->>'ref');
  IF ref_input IS NOT NULL AND ref_input <> '' THEN
    SELECT id INTO ref_id FROM public.profiles WHERE referral_code = ref_input;
    IF ref_id IS NULL THEN
      BEGIN ref_id := ref_input::uuid; EXCEPTION WHEN others THEN ref_id := NULL; END;
    END IF;
  END IF;

  new_code := public.gen_referral_code();

  INSERT INTO public.profiles(id,email,full_name,referred_by,referral_code)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', ref_id, new_code);

  IF ref_id IS NOT NULL THEN
    UPDATE public.profiles SET referral_count = referral_count + 1 WHERE id = ref_id;
  END IF;

  IF NEW.email = admin_email THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END $$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Add FKs to profiles for PostgREST embeds
ALTER TABLE public.deposit_requests
  ADD CONSTRAINT deposit_requests_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.withdrawals
  ADD CONSTRAINT withdrawals_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.product_orders
  ADD CONSTRAINT product_orders_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
