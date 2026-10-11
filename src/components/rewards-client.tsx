import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gift, CheckCircle2, Clock, Upload, ExternalLink, RotateCw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getRewards, spinWheel, submitTask, type Prize, type Task, type Submission, type Spin } from "@/lib/rewards.functions";
import { compressProof } from "@/lib/proof-image";

type Data = Awaited<ReturnType<typeof getRewards>>;
export function RewardsClient({ mode, onCredit }: { mode: "wheel" | "tasks"; onCredit?: () => void }) {
  const load = useServerFn(getRewards);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const reload = async () => { try { setData(await load()); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل المكافآت"); } };
  useEffect(() => { void reload(); }, []);
  if (error) return <div role="alert" className="py-12 text-center space-y-4"><p>{error}</p><Button onClick={reload}><RotateCw />إعادة المحاولة</Button></div>;
  if (!data) return <div className="py-20 text-center text-muted-foreground">جاري التحميل...</div>;
  return mode === "wheel" ? <Wheel data={data} reload={reload} onCredit={onCredit} /> : <section className="space-y-6"><div className="flex items-center gap-3"><CheckCircle2 className="text-success" /><h1 className="text-2xl font-extrabold">المهام</h1></div>{data.tasks.length === 0 && <p className="py-16 text-center text-muted-foreground">لا توجد مهام متاحة حالياً</p>}{data.tasks.map(task => <TaskItem key={task.id} task={task} submission={data.submissions.find(s => s.task_id === task.id)} reload={reload} />)}</section>;
}

function Wheel({ data, reload, onCredit }: { data: Data; reload: () => Promise<void>; onCredit?: () => void }) {
  const spin = useServerFn(spinWheel);
  const [busy, setBusy] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Spin | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const prizes = data.round?.prizes ?? [];
  const previous = data.spins.find(s => s.round_id === data.round?.id);
  const canSpin = data.visible && data.active && data.round?.is_open && !previous && !result && !busy;
  const turn = async () => {
    if (!canSpin || !data.round) return;
    setBusy(true);
    try {
      const outcome = await spin({ data: { roundId: data.round.id } });
      const index = Math.max(0, prizes.findIndex(p => p.id === outcome.prize_id));
      const angle = 360 / prizes.length;
      setRotation(current => current + 1800 + ((360 - (index + 0.5) * angle - current % 360 + 360) % 360));
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      timer.current = setTimeout(async () => { setResult(outcome); setBusy(false); onCredit?.(); toast.success(`جائزتك: ${outcome.label} — ${outcome.amount} USDT`); await reload(); }, reduced ? 100 : 4600);
    } catch (e) { setBusy(false); toast.error(e instanceof Error ? e.message : "تعذر تشغيل العجلة"); }
  };
  if (!data.visible) return <div className="text-center py-20 space-y-3"><Gift className="mx-auto size-10 text-muted-foreground" /><h1 className="text-xl font-bold">العجلة غير متاحة حالياً</h1></div>;
  if (!data.active) return <div className="text-center py-20 space-y-3"><Gift className="mx-auto size-10 text-reward-gold" /><h1 className="text-xl font-bold">عجلة الربح للحسابات المفعلة</h1></div>;
  const shown = result ?? previous;
  return <section className="text-center space-y-6 py-2">
    <div className="flex justify-center items-center gap-2 text-reward-gold text-xs font-bold"><Gift className="size-4" />POLONE REWARDS</div>
    <h1 className="text-3xl font-extrabold">عجلة الربح</h1>
    <p className="text-sm text-muted-foreground">{shown ? "استخدمت محاولتك في هذه الجولة" : data.round?.is_open ? "محاولة واحدة في الجولة الحالية" : "بانتظار فتح جولة جديدة"}</p>
    {prizes.length > 0 && <div className="wheel-stage"><div className="wheel-pointer" /><svg className="reward-wheel" viewBox="0 0 360 360" role="img" aria-label="عجلة جوائز Polone" style={{ transform: `rotate(${rotation}deg)` }}><circle cx="180" cy="180" r="175" className="wheel-rim" />{prizes.map((prize, index) => <WheelSlice key={prize.id} prize={prize} index={index} count={prizes.length} />)}<circle cx="180" cy="180" r="38" className="wheel-hub" /><text x="180" y="184" textAnchor="middle" className="wheel-brand">polone</text></svg></div>}
    {shown && <div role="status" className="py-4 border-y border-reward-gold/30 space-y-2"><Trophy className="mx-auto text-reward-gold" /><p className="font-bold text-lg">{shown.label}</p><p className="text-3xl font-extrabold text-reward-gold" dir="ltr">{shown.amount} <span className="text-sm">USDT</span></p></div>}
    <Button size="lg" className="min-w-48" disabled={!canSpin} onClick={turn}><RotateCw className={busy ? "animate-spin" : ""} />{busy ? "تدور العجلة..." : shown ? "بانتظار الجولة التالية" : "ابدأ الدوران"}</Button>
    {prizes.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-start">{prizes.map(p => <div key={p.id} className="border border-border rounded-lg p-3"><p className="text-xs text-muted-foreground break-words">{p.label}</p><p className="font-bold text-reward-gold" dir="ltr">{p.amount} USDT</p></div>)}</div>}
    {data.spins.length > 0 && <div className="text-start pt-4"><h2 className="font-bold mb-3">جوائزي السابقة</h2>{data.spins.map(s => <div key={s.id} className="flex justify-between gap-3 border-b border-border py-3 text-sm"><div>{s.label}<div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString("ar")}</div></div><span className="text-reward-gold" dir="ltr">{s.amount} USDT</span></div>)}</div>}
  </section>;
}
function WheelSlice({ prize, index, count }: { prize: Prize; index: number; count: number }) {
  const step = Math.PI * 2 / count, start = index * step - Math.PI / 2, end = start + step, middle = start + step / 2;
  const point = (angle: number, r: number) => [180 + Math.cos(angle) * r, 180 + Math.sin(angle) * r];
  const a = point(start, 164), b = point(end, 164), label = point(middle, 108);
  return <g className={`wheel-slice wheel-tone-${index % 4}`}><path d={`M180 180 L${a[0]} ${a[1]} A164 164 0 ${step > Math.PI ? 1 : 0} 1 ${b[0]} ${b[1]} Z`} /><text x={label[0]} y={label[1]} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${middle * 180 / Math.PI + 90},${label[0]},${label[1]})`} className="wheel-label">{prize.amount} USDT</text></g>;
}
function TaskItem({ task, submission, reload }: { task: Task; submission?: Submission; reload: () => Promise<void> }) {
  const submit = useServerFn(submitTask);
  const [links, setLinks] = useState("");
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const allowed = !submission || submission.status === "rejected";
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); if (!proof || uploading) return toast.error("ارفع صورة الإثبات أولاً"); setBusy(true);
    try { await submit({ data: { taskId: task.id, links: links.split(/\n/).map(l => l.trim()).filter(Boolean), proof } }); toast.success("تم إرسال طلب المهمة للمراجعة"); setProof(""); setLinks(""); await reload(); } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر إرسال الطلب"); } finally { setBusy(false); }
  };
  return <article className="border border-border bg-card rounded-lg p-5 space-y-4"><div className="flex items-start justify-between gap-4"><h2 className="font-bold text-lg break-words">{task.title}</h2><span className="text-reward-gold font-extrabold shrink-0" dir="ltr">{task.reward} USDT</span></div><p className="text-muted-foreground text-sm whitespace-pre-wrap break-words">{task.description}</p><Button variant="outline" asChild><a href={task.share_url} target="_blank" rel="noopener noreferrer"><ExternalLink />رابط النشر</a></Button>
    {submission && <div className="flex gap-2 items-center text-sm border-t border-border pt-3">{submission.status === "approved" ? <CheckCircle2 className="text-success" /> : <Clock className="text-reward-gold" />}<div>{submission.status === "approved" ? "مقبولة — تمت إضافة المكافأة" : submission.status === "pending" ? "طلبك قيد المراجعة" : "مرفوضة — يمكنك إعادة إرسال الإثبات"}{submission.admin_note && <p className="text-muted-foreground mt-1">{submission.admin_note}</p>}</div></div>}
    {allowed && <form onSubmit={send} className="space-y-3"><label className="block text-sm space-y-2"><span>روابط المنشورات — كل رابط في سطر</span><textarea required dir="ltr" value={links} onChange={e => setLinks(e.target.value)} rows={3} className="reward-input" placeholder="https://..." /></label><label className="block text-sm space-y-2"><span className="flex items-center gap-2"><Upload className="size-4" />صورة إثبات النشر</span><input required type="file" accept="image/*" disabled={uploading || busy} className="reward-input" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setProof(""); setUploading(true); try { setProof(await compressProof(file)); } catch (err) { toast.error(err instanceof Error ? err.message : "تعذر رفع الصورة"); } finally { setUploading(false); } }} /></label>{proof && <img src={proof} alt="إثبات النشر" className="max-h-48 rounded-lg object-contain" />}<Button type="submit" disabled={busy || uploading || !proof}>{busy ? "جاري الإرسال..." : uploading ? "جاري تجهيز الصورة..." : "إرسال طلب المكافأة"}</Button></form>}
  </article>;
}