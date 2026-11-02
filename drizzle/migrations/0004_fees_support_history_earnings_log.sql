-- Withdrawal fee step
ALTER TABLE public.withdrawals ADD COLUMN fee_status text NOT NULL DEFAULT 'none';
ALTER TABLE public.withdrawals ADD COLUMN fee_tx text;

CREATE OR REPLACE FUNCTION public.request_network_withdrawal(_amount numeric,_wallet text,_network text,_fee_tx text) RETURNS public.withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); p public.profiles; result public.withdrawals; pct numeric:=0; fee numeric;
BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'يرجى تسجيل الدخول'; END IF;
IF _network NOT IN ('TRON','BNB','ETHEREUM','SOLANA') THEN RAISE EXCEPTION 'اختر شبكة صحيحة'; END IF;
IF _amount IS NULL OR _amount < 49 OR _amount <> round(_amount,2) THEN RAISE EXCEPTION 'الحد الأدنى للسحب 49$ وبمنزلتين عشريتين'; END IF;
IF _wallet IS NULL OR length(trim(_wallet)) NOT BETWEEN 20 AND 200 THEN RAISE EXCEPTION 'عنوان المحفظة غير صالح'; END IF;
SELECT * INTO p FROM public.profiles WHERE id=uid FOR UPDATE;
IF p.id IS NULL OR NOT p.is_active THEN RAISE EXCEPTION 'الحساب غير مفعّل'; END IF;
IF p.balance < _amount THEN RAISE EXCEPTION 'الرصيد غير كافٍ'; END IF;
BEGIN SELECT least(100,greatest(0,value::numeric)) INTO pct FROM public.settings WHERE key='withdraw_fee_percent'; EXCEPTION WHEN others THEN pct:=0; END;
pct:=coalesce(pct,0); fee:=round(_amount*pct/100,2);
IF fee > 0 AND (_fee_tx IS NULL OR length(trim(_fee_tx)) NOT BETWEEN 6 AND 200) THEN RAISE EXCEPTION 'أدخل رقم معاملة دفع الرسوم'; END IF;
INSERT INTO public.withdrawals(user_id,wallet_address,amount,network,fee_percent,fee_amount,fee_wallet,fee_notice,status,fee_status,fee_tx)
VALUES(uid,trim(_wallet),_amount,_network,pct,fee,coalesce((SELECT value FROM public.settings WHERE key='withdraw_fee_wallet'),''),coalesce((SELECT value FROM public.settings WHERE key='withdraw_fee_notice'),''),
 CASE WHEN fee>0 THEN 'fee_pending' ELSE 'pending' END, CASE WHEN fee>0 THEN 'pending' ELSE 'none' END, nullif(trim(coalesce(_fee_tx,'')),'')) RETURNING * INTO result;
UPDATE public.profiles SET balance=balance-_amount WHERE id=uid;
RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.request_network_withdrawal(numeric,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_network_withdrawal(numeric,text,text,text) TO authenticated;

-- Support history and unread state
ALTER TABLE public.support_conversations ADD COLUMN status text NOT NULL DEFAULT 'open';
ALTER TABLE public.support_conversations ADD COLUMN closed_at timestamptz;
ALTER TABLE public.support_conversations ADD COLUMN last_user_message_at timestamptz;
ALTER TABLE public.support_conversations ADD COLUMN last_admin_message_at timestamptz;
ALTER TABLE public.support_conversations ADD COLUMN user_read_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.support_conversations ADD COLUMN admin_read_at timestamptz NOT NULL DEFAULT '1970-01-01';
UPDATE public.support_conversations SET last_user_message_at=created_at WHERE last_user_message_at IS NULL;

CREATE OR REPLACE FUNCTION public.support_track_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner uuid; BEGIN
SELECT user_id INTO owner FROM public.support_conversations WHERE id=NEW.conversation_id;
IF NEW.is_auto THEN UPDATE public.support_conversations SET updated_at=now() WHERE id=NEW.conversation_id;
ELSIF NEW.sender_id=owner THEN UPDATE public.support_conversations SET updated_at=now(), last_user_message_at=now() WHERE id=NEW.conversation_id;
ELSE UPDATE public.support_conversations SET updated_at=now(), last_admin_message_at=now() WHERE id=NEW.conversation_id; END IF;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.support_track_message() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER support_track_message_after_insert AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.support_track_message();

CREATE OR REPLACE FUNCTION public.support_mark_read(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF public.has_role(auth.uid(),'admin') THEN UPDATE public.support_conversations SET admin_read_at=now() WHERE id=_id;
ELSE UPDATE public.support_conversations SET user_read_at=now() WHERE id=_id AND user_id=auth.uid(); END IF;
END $$;
REVOKE ALL ON FUNCTION public.support_mark_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_mark_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_close(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'غير مصرح'; END IF;
UPDATE public.support_conversations SET status='closed', closed_at=now(), updated_at=now() WHERE id=_id;
END $$;
REVOKE ALL ON FUNCTION public.support_close(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_close(uuid) TO authenticated;

DROP POLICY messages_send ON public.support_messages;
CREATE POLICY messages_send ON public.support_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.support_conversations c WHERE c.id = conversation_id AND c.status='open' AND (c.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- Notification audiences
ALTER TABLE public.notifications ADD COLUMN audience text NOT NULL DEFAULT 'all';
DROP POLICY "clients view relevant notifications" ON public.notifications;
CREATE POLICY "clients view relevant notifications" ON public.notifications FOR SELECT TO authenticated USING (
  target_user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR (target_user_id IS NULL AND (
    audience='all'
    OR (audience='active' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active))
    OR (audience='inactive' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND NOT p.is_active)))));

-- Featured packages
ALTER TABLE public.packages ADD COLUMN priority integer NOT NULL DEFAULT 0;
ALTER TABLE public.packages ADD COLUMN badge text NOT NULL DEFAULT '';

-- Optional task proof
CREATE OR REPLACE FUNCTION public.submit_publication_task(_task_id uuid,_links text[],_proof_image text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE uid uuid:=auth.uid(); t public.publication_tasks; sid uuid; img text:=coalesce(_proof_image,''); BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'يرجى تسجيل الدخول'; END IF;
SELECT * INTO t FROM public.publication_tasks WHERE id=_task_id AND is_active FOR SHARE; IF t.id IS NULL THEN RAISE EXCEPTION 'المهمة غير متاحة'; END IF;
IF array_length(_links,1) IS NULL OR array_length(_links,1)>10 OR EXISTS(SELECT 1 FROM unnest(_links) l WHERE length(trim(l))=0 OR length(l)>2000) THEN RAISE EXCEPTION 'اكتب تفاصيل المهمة'; END IF;
IF img<>'' AND (length(img)>1100000 OR img !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') THEN RAISE EXCEPTION 'صورة الإثبات غير صالحة أو كبيرة'; END IF;
INSERT INTO public.task_submissions(task_id,user_id,links,proof_image,reward) VALUES(t.id,uid,_links,img,t.reward) ON CONFLICT(task_id,user_id) DO UPDATE SET links=EXCLUDED.links,proof_image=EXCLUDED.proof_image,reward=EXCLUDED.reward,status='pending',admin_note='',processed_at=NULL,created_at=now() WHERE task_submissions.status='rejected' RETURNING id INTO sid;
IF sid IS NULL THEN RAISE EXCEPTION 'سبق إرسال هذه المهمة'; END IF; RETURN sid; END $$;

-- Earnings log (45 days)
CREATE TABLE public.earning_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, source text NOT NULL, amount numeric NOT NULL, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX earning_logs_user_idx ON public.earning_logs(user_id, created_at DESC);
CREATE INDEX earning_logs_created_idx ON public.earning_logs(created_at);
GRANT SELECT, INSERT, DELETE ON public.earning_logs TO authenticated;
GRANT ALL ON public.earning_logs TO service_role;
ALTER TABLE public.earning_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY earning_logs_read ON public.earning_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY earning_logs_admin_insert ON public.earning_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY earning_logs_admin_delete ON public.earning_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.earning_logs_cleanup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN DELETE FROM public.earning_logs WHERE created_at < now() - interval '45 days'; RETURN NULL; END $$;
REVOKE ALL ON FUNCTION public.earning_logs_cleanup() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER earning_logs_cleanup_after AFTER INSERT ON public.earning_logs FOR EACH STATEMENT EXECUTE FUNCTION public.earning_logs_cleanup();

CREATE OR REPLACE FUNCTION public.log_earning() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF TG_TABLE_NAME='daily_yields' THEN INSERT INTO public.earning_logs(user_id,source,amount) VALUES(NEW.user_id,'yield',NEW.amount);
ELSIF TG_TABLE_NAME='wheel_spins' THEN INSERT INTO public.earning_logs(user_id,source,amount,note) VALUES(NEW.user_id,'wheel',NEW.amount,NEW.label);
ELSIF TG_TABLE_NAME='task_submissions' THEN IF NEW.status='approved' AND OLD.status IS DISTINCT FROM 'approved' THEN INSERT INTO public.earning_logs(user_id,source,amount,note) VALUES(NEW.user_id,'task',NEW.reward,coalesce((SELECT title FROM public.publication_tasks WHERE id=NEW.task_id),'')); END IF;
ELSIF TG_TABLE_NAME='deposit_requests' THEN IF NEW.status='approved' AND OLD.status IS DISTINCT FROM 'approved' AND NEW.package_id IS NULL THEN INSERT INTO public.earning_logs(user_id,source,amount) VALUES(NEW.user_id,'deposit',NEW.amount); END IF;
ELSIF TG_TABLE_NAME='referral_milestone_claims' THEN INSERT INTO public.earning_logs(user_id,source,amount) VALUES(NEW.user_id,'referral',NEW.amount);
ELSIF TG_TABLE_NAME='agent_grants' THEN INSERT INTO public.earning_logs(user_id,source,amount) VALUES(NEW.to_user,'agent',NEW.amount);
ELSIF TG_TABLE_NAME='transfers' THEN INSERT INTO public.earning_logs(user_id,source,amount) VALUES(NEW.to_user,'transfer',NEW.amount);
ELSIF TG_TABLE_NAME='profiles' THEN IF NEW.balance > 0 THEN INSERT INTO public.earning_logs(user_id,source,amount) VALUES(NEW.id,'welcome',NEW.balance); END IF;
END IF;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.log_earning() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER log_earning_yield AFTER INSERT ON public.daily_yields FOR EACH ROW EXECUTE FUNCTION public.log_earning();
CREATE TRIGGER log_earning_wheel AFTER INSERT ON public.wheel_spins FOR EACH ROW EXECUTE FUNCTION public.log_earning();
CREATE TRIGGER log_earning_task AFTER UPDATE ON public.task_submissions FOR EACH ROW EXECUTE FUNCTION public.log_earning();
CREATE TRIGGER log_earning_deposit AFTER UPDATE ON public.deposit_requests FOR EACH ROW EXECUTE FUNCTION public.log_earning();
CREATE TRIGGER log_earning_referral AFTER INSERT ON public.referral_milestone_claims FOR EACH ROW EXECUTE FUNCTION public.log_earning();
CREATE TRIGGER log_earning_agent AFTER INSERT ON public.agent_grants FOR EACH ROW EXECUTE FUNCTION public.log_earning();
CREATE TRIGGER log_earning_transfer AFTER INSERT ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.log_earning();
CREATE TRIGGER log_earning_welcome AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_earning();

INSERT INTO public.earning_logs(user_id,source,amount,created_at) SELECT user_id,'yield',amount,created_at FROM public.daily_yields WHERE created_at > now()-interval '45 days';
INSERT INTO public.earning_logs(user_id,source,amount,note,created_at) SELECT user_id,'wheel',amount,label,created_at FROM public.wheel_spins WHERE created_at > now()-interval '45 days';
INSERT INTO public.earning_logs(user_id,source,amount,created_at) SELECT user_id,'task',reward,coalesce(processed_at,created_at) FROM public.task_submissions WHERE status='approved' AND coalesce(processed_at,created_at) > now()-interval '45 days';