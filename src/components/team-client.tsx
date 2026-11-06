import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ImagePlus, LoaderCircle, Plus, Send, Trash2, UserPlus, UsersRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { compressProof } from "@/lib/proof-image";

type Team = { id: string; name: string; owner_id: string };
type Member = { user_id: string; full_name: string | null; referral_code: string; balance: number | null; is_active: boolean; package_name: string | null };
type Msg = { id: string; sender_id: string; body: string; image: string | null; created_at: string };
const db = supabase as any;
const time = (s: string) => new Date(s).toLocaleString("ar-IQ", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });

export function TeamClient() {
  const [uid, setUid] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [showBalance, setShowBalance] = useState(true);

  const load = useCallback(async () => {
    const { data } = await db.from("teams").select("id,name,owner_id").order("created_at", { ascending: false });
    setTeams(data ?? []); setReady(true);
  }, []);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      const { data: p } = await db.from("profiles").select("show_balance").eq("id", data.user.id).single();
      setShowBalance(p?.show_balance ?? true);
    });
    void load();
  }, [load]);

  const create = async () => {
    const { error } = await db.rpc("create_team", { _name: name });
    if (error) return toast.error("تعذر إنشاء المجموعة");
    setName(""); toast.success("تم إنشاء المجموعة"); void load();
  };
  const togglePrivacy = async (v: boolean) => {
    setShowBalance(v);
    const { error } = await db.from("profiles").update({ show_balance: v }).eq("id", uid);
    if (error) { setShowBalance(!v); toast.error("تعذر الحفظ"); } else toast.success(v ? "رصيدك ظاهر لأعضاء المجموعات" : "رصيدك مخفي عن أعضاء المجموعات");
  };

  if (selected) return <TeamRoom team={selected} uid={uid} onBack={() => setSelected(null)} />;

  return <div className="space-y-4">
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="flex items-center gap-2 font-bold"><UsersRound className="size-5 text-primary" />مجموعات Team</h2>
      <div className="flex gap-2">
        <input className="reward-input flex-1" maxLength={60} placeholder="اسم المجموعة الجديدة" value={name} onChange={e => setName(e.target.value)} />
        <Button disabled={!name.trim()} onClick={create}><Plus />إنشاء</Button>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
        <span>إظهار رصيدي لأعضاء المجموعات</span>
        <input type="checkbox" checked={showBalance} onChange={e => togglePrivacy(e.target.checked)} />
      </label>
    </div>
    {!ready ? <LoaderCircle className="mx-auto animate-spin" /> : !teams.length ? <p className="text-center text-sm text-muted-foreground">لا توجد مجموعات بعد</p> :
      teams.map(t => <button key={t.id} onClick={() => setSelected(t)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-start transition-colors hover:bg-secondary">
        <div className="grid size-10 place-items-center rounded-full bg-primary/15 font-bold text-primary">{t.name.slice(0, 1)}</div>
        <span className="flex-1 font-semibold">{t.name}</span>
      </button>)}
  </div>;
}

function TeamRoom({ team, uid, onBack }: { team: Team; uid: string; onBack: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Member | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const loadMembers = useCallback(async () => { const { data } = await db.rpc("team_profiles", { _team: team.id }); setMembers(data ?? []); }, [team.id]);
  const loadMessages = useCallback(async () => {
    const { data } = await db.from("team_messages").select("id,sender_id,body,image,created_at").eq("team_id", team.id).order("created_at").limit(500);
    setMessages(data ?? []);
  }, [team.id]);
  useEffect(() => {
    void loadMembers(); void loadMessages();
    const ch = supabase.channel(`team-${team.id}`).on("postgres_changes", { event: "*", schema: "public", table: "team_messages", filter: `team_id=eq.${team.id}` }, () => { void loadMessages(); }).subscribe();
    const timer = window.setInterval(() => { void loadMessages(); }, 4000);
    return () => { void supabase.removeChannel(ch); clearInterval(timer); };
  }, [team.id, loadMembers, loadMessages]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  const byId = Object.fromEntries(members.map(m => [m.user_id, m]));
  const send = async () => {
    if (!text.trim() && !image) return;
    setBusy(true);
    const { error } = await db.from("team_messages").insert({ team_id: team.id, sender_id: uid, body: text.trim(), image: image || null });
    setBusy(false);
    if (error) return toast.error("تعذر الإرسال");
    setText(""); setImage(""); void loadMessages();
  };
  const remove = async (id: string) => {
    if (!confirm("حذف هذه الرسالة؟")) return;
    const { error } = await db.from("team_messages").delete().eq("id", id);
    if (error) toast.error("تعذر الحذف"); else void loadMessages();
  };
  const add = async () => {
    const { error } = await db.rpc("add_team_member", { _team: team.id, _code: code });
    if (error) return toast.error(error.message.includes("غير موجود") ? "رقم الإحالة غير موجود" : "تعذر الإضافة");
    setCode(""); toast.success("تمت إضافة العضو"); void loadMembers();
  };
  const pick = async (f?: File) => {
    if (!f) return;
    try { setImage(await compressProof(f)); } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر تجهيز الصورة"); }
    if (fileRef.current) fileRef.current.value = "";
  };

  return <section className="flex h-[calc(100vh-12rem)] min-h-[420px] flex-col overflow-hidden rounded-xl border border-border bg-background">
    <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
      <Button size="icon" variant="ghost" onClick={onBack} aria-label="رجوع"><ArrowRight /></Button>
      <div className="min-w-0 flex-1"><div className="truncate font-semibold">{team.name}</div><div className="text-xs text-muted-foreground">{members.length} عضو</div></div>
      <Button size="sm" variant={showMembers ? "secondary" : "ghost"} onClick={() => setShowMembers(v => !v)}><UsersRound />الأعضاء</Button>
    </header>
    {showMembers && <div className="max-h-[40%] overflow-y-auto border-b border-border bg-secondary/40 p-3 space-y-2">
      <div className="flex gap-2"><input className="reward-input flex-1" inputMode="numeric" placeholder="رقم إحالة العضو" value={code} onChange={e => setCode(e.target.value)} /><Button disabled={!code.trim()} onClick={add}><UserPlus />إضافة</Button></div>
      {members.map(m => <button key={m.user_id} onClick={() => setProfile(m)} className="flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-start text-sm">
        <div className="grid size-8 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{(m.full_name || "ع").slice(0, 1)}</div>
        <span className="flex-1 truncate">{m.full_name || "عميل"}</span><span className="text-xs text-muted-foreground">#{m.referral_code}</span>
      </button>)}
    </div>}
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      {!messages.length && <p className="pt-8 text-center text-sm text-muted-foreground">ابدأ الدردشة مع مجموعتك</p>}
      {messages.map(m => {
        const mine = m.sender_id === uid; const who = byId[m.sender_id];
        return <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
          <div className={`group max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${mine ? "rounded-ss-sm bg-primary text-primary-foreground" : "rounded-se-sm bg-card"}`}>
            {!mine && <button onClick={() => who && setProfile(who)} className="mb-0.5 block text-[11px] font-semibold text-primary">{who?.full_name || "عضو"}</button>}
            {m.image && <a href={m.image} target="_blank" rel="noreferrer"><img src={m.image} alt="صورة مرفقة" className="mb-1 max-h-60 rounded-lg object-contain" /></a>}
            {m.body && <p dir="auto" className="whitespace-pre-wrap break-words text-sm">{m.body}</p>}
            <div className="mt-0.5 flex items-center justify-end gap-2 text-[10px] opacity-70"><time>{time(m.created_at)}</time>{mine && <button onClick={() => remove(m.id)} aria-label="حذف الرسالة"><Trash2 className="size-3" /></button>}</div>
          </div>
        </div>;
      })}
      <div ref={bottom} />
    </div>
    {image && <div className="flex items-center gap-2 border-t border-border bg-card p-2"><img src={image} alt="معاينة" className="h-14 rounded" /><Button size="icon" variant="ghost" onClick={() => setImage("")} aria-label="إزالة الصورة"><X /></Button></div>}
    <form className="flex items-end gap-2 border-t border-border bg-card p-2" onSubmit={e => { e.preventDefault(); void send(); }}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => void pick(e.target.files?.[0])} />
      <Button type="button" size="icon" variant="ghost" onClick={() => fileRef.current?.click()} aria-label="إرفاق صورة"><ImagePlus /></Button>
      <textarea className="reward-input min-h-10 flex-1 resize-none rounded-full" rows={1} maxLength={3000} placeholder="اكتب رسالة…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
      <Button type="submit" size="icon" className="rounded-full" disabled={busy || (!text.trim() && !image)} aria-label="إرسال">{busy ? <LoaderCircle className="animate-spin" /> : <Send />}</Button>
    </form>
    {profile && <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4" onClick={() => setProfile(null)}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 space-y-2 text-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><b className="text-base">{profile.full_name || "عميل"}</b><Button size="icon" variant="ghost" onClick={() => setProfile(null)} aria-label="إغلاق"><X /></Button></div>
        <div>رقم الإحالة: <b>{profile.referral_code}</b></div>
        <div>الرصيد: <b>{profile.balance === null ? "مخفي" : `$${Number(profile.balance).toFixed(2)}`}</b></div>
        <div>الباقة: {profile.package_name || "بدون باقة"}</div>
        <div>الحالة: {profile.is_active ? "مفعّل" : "غير مفعّل"}</div>
      </div>
    </div>}
  </section>;
}
