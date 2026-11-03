ALTER TABLE public.profiles ADD COLUMN is_banned boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_ban_flag() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF NEW.is_banned IS DISTINCT FROM OLD.is_banned AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN NEW.is_banned := OLD.is_banned; END IF;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.guard_ban_flag() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_ban_flag BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_ban_flag();

CREATE OR REPLACE FUNCTION public.block_banned() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid;
BEGIN
IF TG_TABLE_NAME='transfers' THEN uid := NEW.from_user; ELSE uid := NEW.user_id; END IF;
IF EXISTS (SELECT 1 FROM public.profiles WHERE id=uid AND is_banned) AND NOT public.has_role(coalesce(auth.uid(),'00000000-0000-0000-0000-000000000000'::uuid),'admin') THEN RAISE EXCEPTION 'account_banned'; END IF;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.block_banned() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER block_banned_withdrawals BEFORE INSERT ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.block_banned();
CREATE TRIGGER block_banned_deposits BEFORE INSERT ON public.deposit_requests FOR EACH ROW EXECUTE FUNCTION public.block_banned();
CREATE TRIGGER block_banned_transfers BEFORE INSERT ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.block_banned();
CREATE TRIGGER block_banned_tasks BEFORE INSERT ON public.task_submissions FOR EACH ROW EXECUTE FUNCTION public.block_banned();
CREATE TRIGGER block_banned_spins BEFORE INSERT ON public.wheel_spins FOR EACH ROW EXECUTE FUNCTION public.block_banned();
CREATE TRIGGER block_banned_orders BEFORE INSERT ON public.product_orders FOR EACH ROW EXECUTE FUNCTION public.block_banned();