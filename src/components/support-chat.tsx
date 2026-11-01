import { useCallback, useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { MessageCircle, Send, X, Trash2, LoaderCircle, ImagePlus, Bot, ArrowRight, Info, Headset } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { supportCustomer } from '@/lib/support.functions';
import { compressProof } from '@/lib/proof-image';
import type { Database } from '@/integrations/supabase/types';

type Conversation = Database['public']['Tables']['support_conversations']['Row'];
type Message = Database['public']['Tables']['support_messages']['Row'];
type AutoReply = Database['public']['Tables']['support_auto_replies']['Row'];
const CATEGORIES = ['مشكلة في السحب', 'مشكلة في الإيداع', 'الباقة والأرباح', 'الإحالات', 'مشكلة في الحساب', 'أخرى'];
const time = (s: string) => new Date(s).toLocaleString('ar-IQ', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

function AutoReplies() {
  const [rows, setRows] = useState<AutoReply[]>([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [reply, setReply] = useState('');
  const load = useCallback(async () => { const { data } = await supabase.from('support_auto_replies').select('*').order('created_at'); setRows(data ?? []); }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (!reply.trim()) return;
    const { error } = await supabase.from('support_auto_replies').upsert({ category, reply: reply.trim(), is_active: true }, { onConflict: 'category' });
    if (error) return toast.error('تعذر حفظ الرد');
    setReply(''); toast.success('تم حفظ الرد الآلي'); void load();
  };
  const toggle = async (r: AutoReply) => { await supabase.from('support_auto_replies').update({ is_active: !r.is_active }).eq('id', r.id); void load(); };
  const remove = async (r: AutoReply) => { await supabase.from('support_auto_replies').delete().eq('id', r.id); void load(); };
  return <details className="rounded-xl border border-border bg-card p-4">
    <summary className="flex cursor-pointer items-center gap-2 font-semibold"><Bot className="size-4 text-primary" />الردود الآلية ({rows.length})</summary>
    <p className="mt-2 text-xs text-muted-foreground">يُرسل الرد تلقائياً للعميل فور فتح محادثة من نوع المشكلة المختار.</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
      <select className="reward-input" value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}<option value="*">أي مشكلة أخرى</option></select>
      <textarea className="reward-input" rows={2} maxLength={3000} placeholder="نص الرد الآلي…" value={reply} onChange={e => setReply(e.target.value)} />
      <Button onClick={save} disabled={!reply.trim()}>حفظ</Button>
    </div>
    <div className="mt-3 space-y-2">{rows.map(r => <div key={r.id} className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm">
      <div className="min-w-0 flex-1"><b className="text-xs">{r.category === '*' ? 'أي مشكلة أخرى' : r.category}</b><p className="whitespace-pre-wrap break-words text-muted-foreground">{r.reply}</p></div>
      <Button size="sm" variant="outline" onClick={() => toggle(r)}>{r.is_active ? 'إيقاف' : 'تفعيل'}</Button>
      <Button size="icon" variant="ghost" onClick={() => remove(r)} aria-label="حذف الرد"><Trash2 /></Button>
    </div>)}</div>
  </details>;
}

export function SupportChat({ admin = false }: { admin?: boolean }) {
  const [open, setOpen] = useState(admin);
  const [uid, setUid] = useState('');
  const [conversations, setConversations] = useState<(Conversation & { profiles?: { full_name: string | null; referral_code: string } | null })[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [details, setDetails] = useState<Awaited<ReturnType<typeof supportCustomer>> | null>(null);
  const getDetails = useServerFn(supportCustomer);
  const bottom = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = conversations.find(c => c.id === selected);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('support_conversations').select('*,profiles(full_name,referral_code)').order('updated_at', { ascending: false });
    if (error) { toast.error('تعذر تحميل المحادثات'); return; }
    setConversations(data ?? []);
    setSelected(old => admin ? ((data ?? []).some(c => c.id === old) ? old : null) : data?.[0]?.id ?? null);
    setReady(true);
  }, [admin]);

  useEffect(() => {
    if (!open) return;
    void supabase.auth.getUser().then(({ data }) => { if (data.user) setUid(data.user.id); });
    void load();
    const channel = supabase.channel(`support-list-${admin}`).on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => { void load(); }).subscribe();
    const timer = window.setInterval(() => { void load(); }, 6000);
    return () => { void supabase.removeChannel(channel); clearInterval(timer); };
  }, [open, admin, load]);

  const read = useCallback(async (id: string) => {
    const { data, error } = await supabase.from('support_messages').select('*').eq('conversation_id', id).order('created_at').order('id');
    if (!error) setMessages(data ?? []);
  }, []);

  useEffect(() => {
    setMessages([]); setDetails(null); setShowInfo(false);
    if (!selected || !open) return;
    void read(selected);
    const channel = supabase.channel(`support-thread-${selected}`).on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${selected}` }, () => { void read(selected); }).subscribe();
    const timer = window.setInterval(() => { void read(selected); }, 3000);
    return () => { void supabase.removeChannel(channel); clearInterval(timer); };
  }, [selected, open, read]);

  useEffect(() => {
    if (!admin || !current?.user_id || !showInfo || details) return;
    void getDetails({ data: { userId: current.user_id } }).then(setDetails).catch(() => toast.error('تعذر تحميل معلومات العميل'));
  }, [current?.user_id, admin, showInfo]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages.length]);

  const start = async () => {
    if (!uid || !description.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('support_conversations').insert({ user_id: uid, category, description: description.trim() });
      if (error) throw error;
      setDescription(''); await load();
    } catch { toast.error('تعذر فتح المحادثة، حاول مجدداً'); } finally { setBusy(false); }
  };
  const pick = async (file?: File) => {
    if (!file) return;
    try { setImage(await compressProof(file)); } catch (e) { toast.error(e instanceof Error ? e.message : 'تعذر تجهيز الصورة'); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const send = async () => {
    if (!selected || !uid || (!text.trim() && !image)) return;
    setBusy(true);
    const { error } = await supabase.from('support_messages').insert({ conversation_id: selected, sender_id: uid, body: text.trim(), image: image || null });
    setBusy(false);
    if (error) { toast.error('تعذر إرسال الرسالة'); return; }
    setText(''); setImage('');
    await supabase.from('support_conversations').update({ updated_at: new Date().toISOString() }).eq('id', selected);
    void read(selected);
  };
  const finish = async () => {
    if (!selected || !window.confirm('إنهاء المحادثة وحذفها مع جميع رسائلها نهائياً؟')) return;
    setBusy(true);
    const { error } = await supabase.from('support_conversations').delete().eq('id', selected);
    setBusy(false);
    if (error) return toast.error('تعذر إنهاء المحادثة');
    setSelected(null); setMessages([]); await load(); toast.success('تم إنهاء المحادثة وحذفها');
  };

  if (!open) return <Button onClick={() => setOpen(true)} className="fixed bottom-28 end-4 z-40 h-12 w-12 rounded-full shadow-lg" size="icon" aria-label="الدعم المباشر" title="الدعم المباشر"><MessageCircle /></Button>;

  const name = current ? (admin ? current.profiles?.full_name || 'عميل' : 'فريق الدعم') : 'الدعم المباشر';
  const thread = current && <div className="flex min-h-0 flex-1 flex-col">
    <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5">
      {admin && <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setSelected(null)} aria-label="رجوع"><ArrowRight /></Button>}
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 font-bold text-primary">{admin ? name.slice(0, 1) : <Headset className="size-5" />}</div>
      <div className="min-w-0 flex-1"><div className="truncate font-semibold">{name} {admin && <span className="text-xs text-muted-foreground">#{current.profiles?.referral_code}</span>}</div><div className="truncate text-xs text-muted-foreground">{current.category}</div></div>
      {admin && <Button size="icon" variant={showInfo ? 'secondary' : 'ghost'} onClick={() => setShowInfo(v => !v)} aria-label="معلومات العميل"><Info /></Button>}
      {admin && <Button size="icon" variant="ghost" className="text-destructive" disabled={busy} onClick={finish} aria-label="إنهاء المحادثة وحذفها" title="إنهاء المحادثة وحذفها"><Trash2 /></Button>}
      {!admin && <Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="إغلاق الدعم"><X /></Button>}
    </header>
    {admin && showInfo && <div className="max-h-72 overflow-y-auto border-b border-border bg-secondary/40 p-3 text-sm">{!details ? <LoaderCircle className="mx-auto animate-spin" /> : <>
      <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"><div>الاسم: {details.profile.full_name || '—'}</div><div>رمز الإحالة: {details.profile.referral_code}</div><div className="break-all">البريد: {details.profile.email}</div><div>الرصيد: ${Number(details.profile.balance).toFixed(2)}</div><div>الباقة: {details.profile.packages?.name || 'بدون باقة'}</div><div>الإحالات: {details.profile.referral_count}</div><div className="sm:col-span-2">إنشاء الحساب: {new Date(details.profile.created_at).toLocaleString('ar-IQ')}</div></dl>
      <h3 className="mt-3 text-xs font-bold">الإحالات</h3>{details.referrals.map(r => <p className="text-xs" key={r.id}>{r.full_name || 'عميل'} · {r.is_active ? 'مفعّل' : 'غير مفعّل'}</p>)}
      <h3 className="mt-3 text-xs font-bold">سجل الربح اليومي ({details.yields.length})</h3>{details.yields.map(y => <div key={y.id} className="flex justify-between border-b border-border py-1 text-xs"><span>{y.applied_on}</span><span className="text-success">+${Number(y.amount).toFixed(2)}</span></div>)}
    </>}</div>}
    <div className="support-thread min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3" aria-live="polite">
      <div className="mx-auto max-w-[90%] rounded-xl bg-card px-3 py-2 text-center text-xs text-muted-foreground"><b className="block text-foreground">{current.category}</b><span className="whitespace-pre-wrap break-words">{current.description}</span></div>
      {messages.map(m => {
        const mine = m.sender_id === uid;
        const label = m.is_auto ? 'رد آلي' : m.sender_id === current.user_id ? 'العميل' : 'فريق الدعم';
        return <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
          <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${mine ? 'rounded-ss-sm bg-primary text-primary-foreground' : 'rounded-se-sm bg-card text-card-foreground'}`}>
            {!mine && <span className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold text-primary">{m.is_auto && <Bot className="size-3" />}{label}</span>}
            {m.image && <a href={m.image} target="_blank" rel="noreferrer"><img src={m.image} alt="صورة مرفقة" className="mb-1 max-h-60 rounded-lg object-contain" /></a>}
            {m.body && <p dir="auto" className="whitespace-pre-wrap break-words text-sm">{m.body}</p>}
            <time className="mt-0.5 block text-end text-[10px] opacity-70">{time(m.created_at)}</time>
          </div>
        </div>;
      })}
      <div ref={bottom} />
    </div>
    {image && <div className="flex items-center gap-2 border-t border-border bg-card p-2"><img src={image} alt="معاينة" className="h-14 rounded" /><Button size="icon" variant="ghost" onClick={() => setImage('')} aria-label="إزالة الصورة"><X /></Button></div>}
    <form className="flex items-end gap-2 border-t border-border bg-card p-2" onSubmit={e => { e.preventDefault(); void send(); }}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => void pick(e.target.files?.[0])} />
      <Button type="button" size="icon" variant="ghost" onClick={() => fileRef.current?.click()} aria-label="إرفاق صورة"><ImagePlus /></Button>
      <textarea aria-label="رسالتك" placeholder="اكتب رسالتك…" className="reward-input min-h-10 min-w-0 flex-1 resize-none rounded-full" rows={1} maxLength={3000} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
      <Button type="submit" size="icon" className="rounded-full" disabled={busy || (!text.trim() && !image)} aria-label="إرسال الرسالة">{busy ? <LoaderCircle className="animate-spin" /> : <Send />}</Button>
    </form>
  </div>;

  if (admin) return <div className="space-y-4">
    <AutoReplies />
    <section aria-label="الدعم المباشر" className="flex h-[70vh] min-h-[480px] overflow-hidden rounded-xl border border-border bg-background">
      <aside className={`${current ? 'hidden md:flex' : 'flex'} w-full flex-col border-e border-border md:w-72`}>
        <div className="border-b border-border p-3 font-bold">المحادثات ({conversations.length})</div>
        <div className="flex-1 overflow-y-auto">
          {!ready && <LoaderCircle className="mx-auto mt-6 animate-spin" />}
          {ready && !conversations.length && <p className="p-4 text-sm text-muted-foreground">لا توجد محادثات مفتوحة</p>}
          {conversations.map(c => <button key={c.id} onClick={() => setSelected(c.id)} className={`flex w-full items-center gap-3 border-b border-border px-3 py-3 text-start transition-colors hover:bg-secondary ${c.id === selected ? 'bg-secondary' : ''}`}>
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 font-bold text-primary">{(c.profiles?.full_name || 'ع').slice(0, 1)}</div>
            <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><span className="truncate text-sm font-semibold">{c.profiles?.full_name || 'عميل'}</span><span className="shrink-0 text-[10px] text-muted-foreground">{time(c.updated_at)}</span></div><div className="truncate text-xs text-muted-foreground">{c.category}</div></div>
          </button>)}
        </div>
      </aside>
      <div className={`${current ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>{thread || <div className="m-auto text-center text-muted-foreground"><MessageCircle className="mx-auto mb-2 size-10 opacity-40" />اختر محادثة لعرضها</div>}</div>
    </section>
  </div>;

  return <section role="dialog" aria-modal aria-label="الدعم المباشر" className="fixed inset-x-2 top-3 bottom-24 z-50 mx-auto flex max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
    {!ready ? <LoaderCircle className="m-auto animate-spin" /> : thread || <>
      <header className="flex items-center justify-between gap-2 border-b border-border p-4"><div className="flex items-center gap-2"><Headset className="text-primary" /><h2 className="font-bold">الدعم المباشر</h2></div><Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="إغلاق الدعم"><X /></Button></header>
      <div className="space-y-4 overflow-y-auto p-4">
        <label className="block space-y-2 text-sm"><span>نوع المشكلة</span><select className="reward-input" value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="block space-y-2 text-sm"><span>وصف المشكلة</span><textarea className="reward-input" rows={5} maxLength={3000} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <Button className="w-full" disabled={busy || !description.trim() || !uid} onClick={start}>{busy ? <LoaderCircle className="animate-spin" /> : <MessageCircle />}بدء المحادثة</Button>
      </div>
    </>}
  </section>;
}
