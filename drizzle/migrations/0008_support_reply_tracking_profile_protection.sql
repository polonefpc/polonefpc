CREATE OR REPLACE FUNCTION public.guard_profile_account_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
NEW.balance:=OLD.balance; NEW.package_id:=OLD.package_id; NEW.is_active:=OLD.is_active; NEW.activated_at:=OLD.activated_at; NEW.is_banned:=OLD.is_banned; NEW.referral_code:=OLD.referral_code; NEW.referred_by:=OLD.referred_by; NEW.referral_count:=OLD.referral_count; NEW.email:=OLD.email;
END IF; RETURN NEW;
END $$;
CREATE TRIGGER guard_profile_account_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_account_fields();
CREATE OR REPLACE FUNCTION public.track_support_reply(_body text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'غير مصرح'; END IF;
IF length(trim(coalesce(_body,''))) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'رسالة غير صالحة'; END IF;
INSERT INTO public.support_saved_replies(body,uses) VALUES(trim(_body),1) ON CONFLICT(body) DO UPDATE SET uses=support_saved_replies.uses+1;
END $$;
REVOKE EXECUTE ON FUNCTION public.track_support_reply(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.track_support_reply(text) TO authenticated;