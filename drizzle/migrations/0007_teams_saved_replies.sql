ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_balance boolean NOT NULL DEFAULT true;

CREATE TABLE public.support_saved_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body text NOT NULL,
  uses integer NOT NULL DEFAULT 0,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (body)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_saved_replies TO authenticated;
GRANT ALL ON public.support_saved_replies TO service_role;
ALTER TABLE public.support_saved_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin saved replies" ON public.support_saved_replies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
CREATE TABLE public.team_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL DEFAULT '',
  image text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.team_messages(team_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams, public.team_members, public.team_messages TO authenticated;
GRANT ALL ON public.teams, public.team_members, public.team_messages TO service_role;

CREATE OR REPLACE FUNCTION public.is_team_member(_team uuid, _user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id=_team AND user_id=_user)
$$;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view teams" ON public.teams FOR SELECT TO authenticated USING (public.is_team_member(id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "members view members" ON public.team_members FOR SELECT TO authenticated USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "members view messages" ON public.team_messages FOR SELECT TO authenticated USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "members send messages" ON public.team_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_team_member(team_id, auth.uid()) AND length(body) <= 3000);
CREATE POLICY "delete own messages" ON public.team_messages FOR DELETE TO authenticated USING (sender_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.create_team(_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF length(trim(coalesce(_name,''))) = 0 OR length(_name) > 60 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  INSERT INTO public.teams(name, owner_id) VALUES (trim(_name), auth.uid()) RETURNING id INTO t;
  INSERT INTO public.team_members(team_id, user_id) VALUES (t, auth.uid());
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.add_team_member(_team uuid, _code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid;
BEGIN
  IF NOT public.is_team_member(_team, auth.uid()) THEN RAISE EXCEPTION 'not_member'; END IF;
  SELECT id INTO u FROM public.profiles WHERE referral_code = trim(_code);
  IF u IS NULL THEN RAISE EXCEPTION 'رقم الإحالة غير موجود'; END IF;
  INSERT INTO public.team_members(team_id, user_id) VALUES (_team, u) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.team_profiles(_team uuid)
RETURNS TABLE(user_id uuid, full_name text, referral_code text, balance numeric, is_active boolean, package_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.referral_code,
         CASE WHEN p.show_balance OR p.id = auth.uid() THEN p.balance ELSE NULL END,
         p.is_active, pk.name
  FROM public.team_members m JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.packages pk ON pk.id = p.package_id
  WHERE m.team_id = _team AND public.is_team_member(_team, auth.uid())
$$;

REVOKE EXECUTE ON FUNCTION public.create_team(text), public.add_team_member(uuid,text), public.team_profiles(uuid), public.is_team_member(uuid,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_team(text), public.add_team_member(uuid,text), public.team_profiles(uuid), public.is_team_member(uuid,uuid) TO authenticated;