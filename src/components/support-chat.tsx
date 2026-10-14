import { useCallback, useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { MessageCircle, Send, X, CheckCheck, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { supportCustomer } from '@/lib/support.functions';
import type { Database } from '@/integrations/supabase/types';

type Conversation = Database['public']['Tables']['support_conversations']['Row'];
type Message = Database['public']['Tables']['support_messages']['Row'];
const date = (s: string) => new Date(s).toLocaleString('ar-IQ');

export function SupportChat({ admin = false }: { admin?: boolean }) {
  const [open, setOpen] = useState(admin);
  const [uid, setUid] = useState('');
  const [conversations, setConversations] = useState<(Conversation & { profiles?: { full_name: string | null; referral_code: string } | null })[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [category, setCategory] = useState('مشكلة في السحب');
  const [description, setDescription] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [details, setDetails] = useState<Awaited<ReturnType<typeof supportCustomer>> | null>(null);
  const getDetails = useServerFn(supportCustomer);
  const bottom = useRef<HTMLDivElement>(null);
  const current = conversations.find(c => c.id === selected);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('support_conversations').select('*,profiles(full_name,referral_code)').order('created_at', { ascending: false });
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
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => { void supabase.removeChannel(channel); clearInterval(timer); };
  }, [open, admin, load]);

  useEffect(() => {
    setMessages([]); setDetails(null);
    if (!selected || !open) return;
    let alive = true;
    const read = async () => {
      const { data, error } = await supabase.from('support_messages').select('*').eq('conversation_id', selected).order('created_at').order('id');
      if (alive && !error) setMessages(data ?? []);
    };
    void read();
    const channel = supabase.channel(`support-thread-${selected}`).on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${selected}` }, () => { void read(); }).subscribe();
    const timer = window.setInterval(() => { void read(); }, 3000);
    return () => { alive = false; void supabase.removeChannel(channel); clearInterval(timer); };
  }, [selected, open]);

  useEffect(() => {
    if (!admin || !current?.user_id) return;
    let alive = true;
    void getDetails({ data: { userId: current.user_id } }).then(d => { if (alive) setDetails(d); }).catch(() => toast.error('تعذر تحميل معلومات العميل'));
    return () => { alive = false; };
  }, [current?.user_id, admin]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages]);

  const start = async () => {
    if (!uid || !description.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('support_conversations').insert({ user_id: uid, category, description: description.trim() });
      if (error) throw error;
      setDescription(''); await load();
    } catch { toast.error('تعذر فتح المحادثة، حاول مجدداً'); } finally { setBusy(false); }
  };
  const send = async () => {
    if (!selected || !uid || !text.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('support_messages').insert({ conversation_id: selected, sender_id: uid, body: text.trim() });
    setBusy(false);
    if (error) { toast.error('تعذر إرسال الرسالة'); return; }
    setText('');
    const { data } = await supabase.from('support_messages').select('*').eq('conversation_id', selected).order('created_at').order('id');
    setMessages(data ?? []);
  };
  const finish = async () => {
    if (!selected || !window.confirm('إنهاء المحادثة وحذفها مع جميع رسائلها نهائياً؟')) return;
    setBusy(true);
    const { error } = await supabase.from('support_conversations').delete().eq('id', selected);
    setBusy(false);
    if (error) return toast.error('تعذر إنهاء المحادثة');
    setSelected(null); setMessages([]); setDetails(null); await load(); toast.success('تم إنهاء المحادثة وحذفها');
  };

  if (!open) return <Button onClick={() => setOpen(true)} className="fixed bottom-28 end-4 z-40 h-12 w-12 rounded-full shadow-lg" size="icon" aria-label="الدعم المباشر" title="الدعم المباشر"><MessageCircle /></Button>;
  return <section role={admin ? undefined : 'dialog'} aria-modal={admin ? undefined : true} aria-label="الدعم المباشر" className={admin ? 'space-y-4' : 'fixed inset-x-2 top-3 bottom-24 z-50 mx-auto flex max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl'}>
    <header className="flex items-center justify-between gap-2 border-b border-border p-4"><div><h2 className="font-bold">الدعم المباشر</h2><span className="text-xs text-muted-foreground">محادثات العملاء</span></div>{!admin && <Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="إغلاق الدعم"><X /></Button>}</header>
    <div className={admin ? 'grid gap-5 md:grid-cols-[230px_minmax(0,1fr)]' : 'min-h-0 flex-1 overflow-y-auto p-4'}>
      {admin && <aside className="space-y-2">{ready && !conversations.length && <p className="p-4 text-sm text-muted-foreground">لا توجد محادثات مفتوحة</p>}{conversations.map(c => <Button key={c.id} variant={c.id === selected ? 'secondary' : 'ghost'} className="h-auto w-full justify-start whitespace-normal py-3 text-start" onClick={() => setSelected(c.id)}><MessageCircle className="shrink-0" /><span className="min-w-0 break-words">{c.profiles?.full_name || 'عميل'} <span className="text-xs text-muted-foreground">#{c.profiles?.referral_code}</span><span className="block text-xs text-muted-foreground">{c.category}</span></span></Button>)}</aside>}
      <div className="min-w-0 space-y-4">
        {!ready ? <LoaderCircle className="mx-auto animate-spin" /> : !current ? admin ? <p className="py-12 text-center text-muted-foreground">اختر حساب العميل</p> : <div className="space-y-4"><label className="block space-y-2 text-sm"><span>نوع المشكلة</span><select className="reward-input" value={category} onChange={e => setCategory(e.target.value)}>{['مشكلة في السحب','مشكلة في الإيداع','الباقة والأرباح','الإحالات','مشكلة في الحساب','أخرى'].map(c => <option key={c}>{c}</option>)}</select></label><label className="block space-y-2 text-sm"><span>وصف المشكلة</span><textarea className="reward-input" rows={5} maxLength={3000} value={description} onChange={e => setDescription(e.target.value)} /></label><Button className="w-full" disabled={busy || !description.trim() || !uid} onClick={start}>{busy ? <LoaderCircle className="animate-spin" /> : <MessageCircle />}بدء المحادثة</Button></div> : <>
          {admin && details && <details className="rounded-lg border border-border bg-card p-3"><summary className="cursor-pointer text-sm font-semibold">معلومات العميل — {details.profile.full_name || details.profile.email}</summary><dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2"><div>الاسم: {details.profile.full_name || '—'}</div><div>رمز الإحالة: {details.profile.referral_code}</div><div className="break-all">البريد: {details.profile.email}</div><div>الرصيد: ${Number(details.profile.balance).toFixed(2)}</div><div>الباقة: {details.profile.packages?.name || 'بدون باقة'}</div><div>الإحالات: {details.profile.referral_count}</div><div className="sm:col-span-2">إنشاء الحساب: {date(details.profile.created_at)}</div></dl><h3 className="mt-4 text-sm font-bold">الإحالات</h3><div className="max-h-40 overflow-y-auto text-xs">{details.referrals.map(r => <p className="py-1" key={r.id}>{r.full_name || 'عميل'} · {r.is_active ? 'مفعّل' : 'غير مفعّل'}</p>)}</div><h3 className="mt-4 text-sm font-bold">سجل الربح اليومي الكامل ({details.yields.length})</h3><div className="max-h-60 overflow-y-auto">{details.yields.map(y => <div key={y.id} className="flex justify-between gap-2 border-b border-border py-2 text-xs"><span>{y.applied_on}</span><span className="text-success">+${Number(y.amount).toFixed(2)}</span></div>)}</div></details>}
          <div className="border-b border-border pb-3"><h3 className="font-semibold">{current.category}</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{current.description}</p></div>
          <div className="h-64 space-y-3 overflow-y-auto overscroll-contain" aria-live="polite">{messages.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">تم استلام المشكلة، يمكنك إضافة رسالة</p>}{messages.map(m => <div key={m.id} className={`max-w-[88%] rounded-lg px-3 py-2 ${m.sender_id === uid ? 'ms-auto bg-primary text-primary-foreground' : 'me-auto border border-border bg-secondary text-secondary-foreground'}`}><span className="mb-1 block text-[10px] opacity-80">{m.sender_id === current.user_id ? 'العميل' : 'فريق الدعم'}</span><p dir="auto" className="whitespace-pre-wrap break-words text-sm">{m.body}</p><time className="mt-1 block text-[10px] opacity-75">{date(m.created_at)}</time></div>)}<div ref={bottom} /></div>
          <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); void send(); }}><textarea aria-label="رسالتك" placeholder="اكتب رسالتك…" className="reward-input min-w-0 flex-1" rows={2} maxLength={3000} value={text} onChange={e => setText(e.target.value)} /><Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="إرسال الرسالة">{busy ? <LoaderCircle className="animate-spin" /> : <Send />}</Button></form>
          {admin && <Button variant="destructive" disabled={busy} onClick={finish}><CheckCheck />إنهاء المحادثة وحذفها</Button>}
        </>}
      </div>
    </div>
  </section>;
}