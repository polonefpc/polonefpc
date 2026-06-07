
-- New package values (daily_rate now represents fixed USDT per day)
UPDATE public.packages SET name='باقة 1', price=90,  daily_rate=2.3  WHERE id=1;
UPDATE public.packages SET name='باقة 2', price=130, daily_rate=6.7  WHERE id=2;
UPDATE public.packages SET name='باقة 3', price=320, daily_rate=15.4 WHERE id=3;
UPDATE public.packages SET name='باقة 4', price=985, daily_rate=41.2 WHERE id=4;

-- Deposit requests: allow package-less deposits (cash top-up) and add amount
ALTER TABLE public.deposit_requests ALTER COLUMN package_id DROP NOT NULL;
ALTER TABLE public.deposit_requests ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 0;
