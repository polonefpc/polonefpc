
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin','agent','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Packages reference
CREATE TABLE public.packages (
  id int PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL,
  daily_rate numeric NOT NULL
);
GRANT SELECT ON public.packages TO authenticated, anon;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads packages" ON public.packages FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.packages(id,name,price,daily_rate) VALUES
(1,'الباقة 1',50,1.0),
(2,'الباقة 2',100,1.5),
(3,'الباقة 3',300,2.0),
(4,'الباقة 4',900,2.3);

-- Profiles (referral_code = user_id text)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  balance numeric NOT NULL DEFAULT 0,
  package_id int REFERENCES public.packages(id),
  is_active boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  referred_by uuid REFERENCES public.profiles(id),
  referral_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own profile" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent'));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "admin manage profiles" ON public.profiles FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Auto create profile + assign user role + handle referral via raw_user_meta_data.ref
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_id uuid;
  ref_text text;
  admin_email text := 'mooh2000mooh2026@gmail.com';
BEGIN
  ref_text := NEW.raw_user_meta_data->>'ref';
  IF ref_text IS NOT NULL AND ref_text <> '' THEN
    BEGIN
      ref_id := ref_text::uuid;
    EXCEPTION WHEN others THEN ref_id := NULL;
    END;
  END IF;

  INSERT INTO public.profiles(id,email,full_name,referred_by)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', ref_id);

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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Deposit requests
CREATE TABLE public.deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id int NOT NULL REFERENCES public.packages(id),
  tx_hash text,
  note text,
  status text NOT NULL DEFAULT 'pending', -- pending/approved/rejected
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT, INSERT ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user sees own deposits" ON public.deposit_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user creates own deposits" ON public.deposit_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin updates deposits" ON public.deposit_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Withdrawals
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0 AND amount <= 40),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user sees own wd" ON public.withdrawals FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user creates wd" ON public.withdrawals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin updates wd" ON public.withdrawals FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Transfers between users
CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0 AND amount <= 40),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own transfers" ON public.transfers FOR SELECT TO authenticated
USING (auth.uid() = from_user OR auth.uid() = to_user OR public.has_role(auth.uid(),'admin'));

-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  price numeric NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage products" ON public.products FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Product orders
CREATE TABLE public.product_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  price numeric NOT NULL,
  shipping_info text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT, INSERT ON public.product_orders TO authenticated;
GRANT ALL ON public.product_orders TO service_role;
ALTER TABLE public.product_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own orders" ON public.product_orders FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "create own orders" ON public.product_orders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin updates orders" ON public.product_orders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Agent contacts (وكلاء الإيداع المحلي)
CREATE TABLE public.agent_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  link text NOT NULL,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agent_contacts TO authenticated;
GRANT ALL ON public.agent_contacts TO service_role;
ALTER TABLE public.agent_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads agent contacts" ON public.agent_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage agent contacts" ON public.agent_contacts FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Settings (deposit wallet address etc.)
CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads settings" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage settings" ON public.settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.settings(key,value) VALUES
('deposit_wallet','TXxxxxxxxxxxxxxxxxxxxxxxxxx'),
('deposit_network','USDT - TRC20');

-- Agent balance
CREATE TABLE public.agent_balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agent_balances TO authenticated;
GRANT ALL ON public.agent_balances TO service_role;
ALTER TABLE public.agent_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent sees own bal" ON public.agent_balances FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage agent bal" ON public.agent_balances FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Agent point grants
CREATE TABLE public.agent_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agent_grants TO authenticated;
GRANT ALL ON public.agent_grants TO service_role;
ALTER TABLE public.agent_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent see own grants" ON public.agent_grants FOR SELECT TO authenticated
USING (auth.uid() = agent_id OR auth.uid() = to_user OR public.has_role(auth.uid(),'admin'));

-- Daily yield log
CREATE TABLE public.daily_yields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  rate numeric NOT NULL,
  applied_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, applied_on)
);
GRANT SELECT ON public.daily_yields TO authenticated;
GRANT ALL ON public.daily_yields TO service_role;
ALTER TABLE public.daily_yields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user see own yields" ON public.daily_yields FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
