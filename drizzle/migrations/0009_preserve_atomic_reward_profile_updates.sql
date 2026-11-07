CREATE OR REPLACE FUNCTION public.guard_profile_account_fields() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
IF current_user IN ('authenticated','anon') AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
NEW.balance:=OLD.balance; NEW.package_id:=OLD.package_id; NEW.is_active:=OLD.is_active; NEW.activated_at:=OLD.activated_at; NEW.is_banned:=OLD.is_banned; NEW.referral_code:=OLD.referral_code; NEW.referred_by:=OLD.referred_by; NEW.referral_count:=OLD.referral_count; NEW.email:=OLD.email;
END IF; RETURN NEW;
END $$;