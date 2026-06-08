
INSERT INTO public.packages (id, name, price, daily_rate)
VALUES (5, 'الأكثر ربحاً', 1530, 67.1)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price, daily_rate=EXCLUDED.daily_rate;

CREATE TABLE IF NOT EXISTS public.deposit_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  address text NOT NULL,
  network text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.deposit_wallets TO anon, authenticated;
GRANT ALL ON public.deposit_wallets TO authenticated;
GRANT ALL ON public.deposit_wallets TO service_role;

ALTER TABLE public.deposit_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view active wallets" ON public.deposit_wallets FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage wallets" ON public.deposit_wallets FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER tg_deposit_wallets_updated BEFORE UPDATE ON public.deposit_wallets FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.settings(key,value) VALUES ('deposit_description','حوّل المبلغ إلى إحدى المحافظ أدناه ثم أرسل طلب الإيداع مع رقم العملية. تتم الموافقة خلال دقائق.')
ON CONFLICT (key) DO NOTHING;
