ALTER TABLE public.deposit_wallets
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS image_url text;