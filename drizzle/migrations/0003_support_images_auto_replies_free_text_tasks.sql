ALTER TABLE public.support_messages ADD COLUMN image text;
ALTER TABLE public.support_messages DROP CONSTRAINT IF EXISTS support_messages_body_check;
ALTER TABLE public.support_messages ADD CONSTRAINT support_messages_content_check CHECK (length(body) <= 3000 AND (length(body) >= 1 OR image IS NOT NULL) AND (image IS NULL OR (length(image) <= 1100000 AND image ~ '^data:image/jpeg;base64,')));
ALTER TABLE public.support_messages ADD COLUMN is_auto boolean NOT NULL DEFAULT false;
CREATE TABLE public.support_auto_replies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category text NOT NULL UNIQUE CHECK (length(category) BETWEEN 1 AND 80), reply text NOT NULL CHECK (length(reply) BETWEEN 1 AND 3000), is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_auto_replies TO authenticated;
GRANT ALL ON public.support_auto_replies TO service_role;
ALTER TABLE public.support_auto_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY auto_replies_read ON public.support_auto_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY auto_replies_admin ON public.support_auto_replies FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.support_auto_reply() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r text; BEGIN
SELECT reply INTO r FROM public.support_auto_replies WHERE is_active AND category=NEW.category;
IF r IS NULL THEN SELECT reply INTO r FROM public.support_auto_replies WHERE is_active AND category='*'; END IF;
IF r IS NOT NULL THEN INSERT INTO public.support_messages(conversation_id,sender_id,body,is_auto) VALUES(NEW.id,'00000000-0000-0000-0000-000000000000',r,true); END IF;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.support_auto_reply() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER support_auto_reply_after_insert AFTER INSERT ON public.support_conversations FOR EACH ROW EXECUTE FUNCTION public.support_auto_reply();
CREATE OR REPLACE FUNCTION public.submit_publication_task(_task_id uuid,_links text[],_proof_image text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE uid uuid:=auth.uid(); t public.publication_tasks; sid uuid; BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'يرجى تسجيل الدخول'; END IF;
SELECT * INTO t FROM public.publication_tasks WHERE id=_task_id AND is_active FOR SHARE; IF t.id IS NULL THEN RAISE EXCEPTION 'المهمة غير متاحة'; END IF;
IF array_length(_links,1) IS NULL OR array_length(_links,1)>10 OR EXISTS(SELECT 1 FROM unnest(_links) l WHERE length(trim(l))=0 OR length(l)>2000) THEN RAISE EXCEPTION 'اكتب تفاصيل المهمة'; END IF;
IF _proof_image IS NULL OR length(_proof_image)>1100000 OR _proof_image !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' THEN RAISE EXCEPTION 'صورة الإثبات غير صالحة أو كبيرة'; END IF;
INSERT INTO public.task_submissions(task_id,user_id,links,proof_image,reward) VALUES(t.id,uid,_links,_proof_image,t.reward) ON CONFLICT(task_id,user_id) DO UPDATE SET links=EXCLUDED.links,proof_image=EXCLUDED.proof_image,reward=EXCLUDED.reward,status='pending',admin_note='',processed_at=NULL,created_at=now() WHERE task_submissions.status='rejected' RETURNING id INTO sid;
IF sid IS NULL THEN RAISE EXCEPTION 'سبق إرسال هذه المهمة'; END IF; RETURN sid; END $$;
REVOKE ALL ON FUNCTION public.submit_publication_task(uuid,text[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_publication_task(uuid,text[],text) TO authenticated;