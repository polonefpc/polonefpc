import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getRewardsAdmin, manageRewards } from "@/lib/rewards.functions";

type AdminData = Awaited<ReturnType<typeof getRewardsAdmin>>;
const box = "glass rounded-xl p-3 space-y-2";
const input = "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm";

export function RewardsAdmin() {
  const load = useServerFn(getRewardsAdmin);
  const manage = useServerFn(manageRewards);
  const [d, setD] = useState<AdminData | null>(null);
  const [prize, setPrize] = useState({ label: "", amount: "", weight: "" });
  const [task, setTask] = useState({ title: "", description: "", share_url: "", reward: "" });
  const [assign, setAssign] = useState({ userId: "", prizeId: "", q: "" });
  const [notes, setNotes] = useState<Record<string, string>>({});

  const reload = async () => { try { setD(await load()); } catch (e: any) { toast.error(e.message); } };
  useEffect(() => { void reload(); }, []);
  const act = async (data: any, ok = "تم الحفظ") => {
    try { await manage({ data }); toast.success(ok); await reload(); return true; } catch (e: any) { toast.error(e.message); return false; }
  };
  if (!d) return <div className="text-muted-foreground">جاري التحميل...</div>;

  const total = d.prizes.filter(p => p.is_active).reduce((s, p) => s + Number(p.weight), 0);
  const name = (id: string) => { const u: any = d.users.find((x: any) => x.id === id); return u ? `${u.full_name || "—"} #${u.referral_code}` : id.slice(0, 8); };
  const activeUsers = d.users.filter((u: any) => u.is_active && (!assign.q || `${u.full_name} ${u.referral_code}`.includes(assign.q)));
  const roundPrizes = d.round?.prizes ?? [];

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-lg">عجلة الربح</h2>
      <div className={box}>
        <label className="flex items-center gap-2 font-bold text-sm">
          <input type="checkbox" checked={d.visible} onChange={e => act({ action: "visible", value: e.target.checked })} /> عرض العجلة للحسابات المفعلة
        </label>
        <div className="text-sm">
          الجولة الحالية: {d.round?.is_open ? <span className="text-success font-bold">مفتوحة</span> : <span className="text-muted-foreground">مغلقة</span>}
          {d.round && <span className="text-xs text-muted-foreground"> · {new Date(d.round.created_at).toLocaleString("ar")} · لعب {d.spins.filter(s => s.round_id === d.round!.id).length}</span>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => act({ action: "open" }, "تم فتح جولة جديدة — كل حساب مفعل له محاولة واحدة")} className="btn-primary px-3 py-1.5 rounded-lg text-sm font-bold">تشغيل جولة جديدة</button>
          {d.round?.is_open && <button onClick={() => act({ action: "close", id: d.round!.id }, "تم إغلاق الجولة")} className="glass px-3 py-1.5 rounded-lg text-sm">إغلاق الجولة</button>}
        </div>
        <p className="text-xs text-muted-foreground">يجب أن يكون مجموع نسب الفوز للأقسام الفعالة 100% (الحالي: {total}%) ومن 2 إلى 12 قسماً.</p>
      </div>

      <div className={box}>
        <div className="font-bold text-sm">أقسام العجلة</div>
        {d.prizes.map(p => (
          <div key={p.id} className="flex items-center gap-2 text-sm border-b border-border pb-2">
            <div className="flex-1">{p.label} · <b>{p.amount} USDT</b> · فوز {p.weight}%</div>
            <button onClick={() => act({ action: "prize", id: p.id, label: p.label, amount: p.amount, weight: p.weight, is_active: !p.is_active, sort_order: p.sort_order })} className="text-xs glass px-2 py-1 rounded">{p.is_active ? "إيقاف" : "تفعيل"}</button>
            <button onClick={() => confirm("حذف القسم؟") && act({ action: "deletePrize", id: p.id }, "تم الحذف")} className="text-xs bg-destructive/90 px-2 py-1 rounded">حذف</button>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2">
          <input className={input} placeholder="الاسم" value={prize.label} onChange={e => setPrize({ ...prize, label: e.target.value })} />
          <input className={input} type="number" placeholder="الجائزة $" value={prize.amount} onChange={e => setPrize({ ...prize, amount: e.target.value })} />
          <input className={input} type="number" placeholder="نسبة الفوز %" value={prize.weight} onChange={e => setPrize({ ...prize, weight: e.target.value })} />
        </div>
        <button onClick={async () => { if (await act({ action: "prize", label: prize.label, amount: Number(prize.amount), weight: Number(prize.weight), is_active: true, sort_order: d.prizes.length })) setPrize({ label: "", amount: "", weight: "" }); }} className="btn-primary px-3 py-1.5 rounded-lg text-sm font-bold">إضافة قسم</button>
      </div>

      {d.round?.is_open && (
        <div className={box}>
          <div className="font-bold text-sm">تحديد الفائز في الجولة الحالية</div>
          <input className={input} placeholder="بحث بالاسم أو المعرف" value={assign.q} onChange={e => setAssign({ ...assign, q: e.target.value })} />
          <select className={input} value={assign.userId} onChange={e => setAssign({ ...assign, userId: e.target.value })}>
            <option value="">اختر الحساب</option>
            {activeUsers.slice(0, 100).map((u: any) => <option key={u.id} value={u.id}>{u.full_name || "—"} #{u.referral_code}</option>)}
          </select>
          <select className={input} value={assign.prizeId} onChange={e => setAssign({ ...assign, prizeId: e.target.value })}>
            <option value="">اختر الجائزة</option>
            {roundPrizes.map(p => <option key={p.id} value={p.id}>{p.label} — {p.amount} USDT</option>)}
          </select>
          <button disabled={!assign.userId || !assign.prizeId} onClick={() => act({ action: "assign", roundId: d.round!.id, userId: assign.userId, prizeId: assign.prizeId }, "سيفوز هذا الحساب بالجائزة المحددة")} className="btn-primary px-3 py-1.5 rounded-lg text-sm font-bold">تحديد</button>
          {d.assignments.filter((a: any) => a.round_id === d.round!.id).map((a: any) => (
            <div key={a.user_id} className="text-xs text-muted-foreground">{name(a.user_id)} ← {roundPrizes.find(p => p.id === a.prize_id)?.label}</div>
          ))}
        </div>
      )}

      <div className={box}>
        <div className="font-bold text-sm">آخر نتائج العجلة</div>
        {d.spins.length === 0 && <div className="text-xs text-muted-foreground">لا توجد نتائج</div>}
        {d.spins.slice(0, 30).map(s => <div key={s.id} className="text-xs flex justify-between"><span>{name(s.user_id)}</span><span>{s.label} · {s.amount} USDT</span></div>)}
      </div>

      <h2 className="font-bold text-lg pt-2">المهام</h2>
      <div className={box}>
        <input className={input} placeholder="عنوان المهمة (مثلاً: شارك رابط المنصة)" value={task.title} onChange={e => setTask({ ...task, title: e.target.value })} />
        <textarea className={input} rows={3} placeholder="وصف المهمة" value={task.description} onChange={e => setTask({ ...task, description: e.target.value })} />
        <input className={input} dir="ltr" placeholder="https:// رابط النشر" value={task.share_url} onChange={e => setTask({ ...task, share_url: e.target.value })} />
        <input className={input} type="number" placeholder="الربح $" value={task.reward} onChange={e => setTask({ ...task, reward: e.target.value })} />
        <button onClick={async () => { if (await act({ action: "task", ...task, reward: Number(task.reward), is_active: true })) setTask({ title: "", description: "", share_url: "", reward: "" }); }} className="btn-primary px-3 py-1.5 rounded-lg text-sm font-bold">إضافة مهمة</button>
        {d.tasks.map(t => (
          <div key={t.id} className="flex items-center gap-2 text-sm border-t border-border pt-2">
            <div className="flex-1">{t.title} · <b>{t.reward} USDT</b></div>
            <button onClick={() => act({ action: "task", id: t.id, title: t.title, description: t.description, share_url: t.share_url, reward: t.reward, is_active: !t.is_active })} className="text-xs glass px-2 py-1 rounded">{t.is_active ? "إخفاء" : "إظهار"}</button>
          </div>
        ))}
      </div>

      <div className={box}>
        <div className="font-bold text-sm">طلبات المهام</div>
        {d.submissions.length === 0 && <div className="text-xs text-muted-foreground">لا توجد طلبات</div>}
        {d.submissions.map(s => (
          <div key={s.id} className="border-t border-border pt-2 space-y-2 text-sm">
            <div className="flex justify-between"><b>{name(s.user_id)}</b><span className={s.status === "approved" ? "text-success" : s.status === "rejected" ? "text-destructive" : "text-reward-gold"}>{s.status === "approved" ? "مقبول" : s.status === "rejected" ? "مرفوض" : "قيد المراجعة"}</span></div>
            <div className="text-xs">{d.tasks.find(t => t.id === s.task_id)?.title} · {s.reward} USDT · {new Date(s.created_at).toLocaleString("ar")}</div>
            {s.links.map(l => <a key={l} href={l} target="_blank" rel="noopener noreferrer" dir="ltr" className="block text-xs text-primary break-all underline">{l}</a>)}
            {s.proof_image && <a href={s.proof_image} target="_blank" rel="noreferrer"><img src={s.proof_image} alt="إثبات" className="max-h-48 rounded-lg" /></a>}
            {s.status === "pending" && (
              <div className="flex gap-2">
                <input className={input} placeholder="ملاحظة (اختياري)" value={notes[s.id] ?? ""} onChange={e => setNotes({ ...notes, [s.id]: e.target.value })} />
                <button onClick={() => act({ action: "review", id: s.id, approve: true, note: notes[s.id] ?? "" }, "تم القبول وإضافة الربح")} className="btn-primary px-3 rounded-lg text-xs font-bold">قبول</button>
                <button onClick={() => act({ action: "review", id: s.id, approve: false, note: notes[s.id] ?? "" }, "تم الرفض")} className="bg-destructive/90 px-3 rounded-lg text-xs font-bold">رفض</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function WithdrawFeeAdmin() {
  const [v, setV] = useState({ percent: "0", wallet: "", notice: "" });
  useEffect(() => {
    supabase.from("settings").select("key,value").in("key", ["withdraw_fee_percent", "withdraw_fee_wallet", "withdraw_fee_notice"]).then(({ data }) => {
      const m = Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
      setV({ percent: m.withdraw_fee_percent ?? "0", wallet: m.withdraw_fee_wallet ?? "", notice: m.withdraw_fee_notice ?? "" });
    });
  }, []);
  const save = async () => {
    const p = Number(v.percent);
    if (!(p >= 0 && p <= 100)) return toast.error("النسبة بين 0 و 100");
    const now = new Date().toISOString();
    const { error } = await supabase.from("settings").upsert([
      { key: "withdraw_fee_percent", value: String(p), updated_at: now },
      { key: "withdraw_fee_wallet", value: v.wallet.trim(), updated_at: now },
      { key: "withdraw_fee_notice", value: v.notice, updated_at: now },
    ]);
    if (error) toast.error(error.message); else toast.success("تم حفظ رسوم السحب");
  };
  return (
    <div className={box}>
      <div className="font-bold">رسوم السحب</div>
      <label className="block text-sm space-y-1"><span>نسبة الرسوم % (0 = بدون رسوم)</span>
        <input className={input} type="number" step="0.1" min={0} max={100} value={v.percent} onChange={e => setV({ ...v, percent: e.target.value })} /></label>
      <label className="block text-sm space-y-1"><span>رقم المحفظة لاستلام الرسوم</span>
        <input className={input} dir="ltr" value={v.wallet} onChange={e => setV({ ...v, wallet: e.target.value })} /></label>
      <label className="block text-sm space-y-1"><span>التنبيه الذي يظهر للعميل</span>
        <textarea className={input} rows={3} value={v.notice} onChange={e => setV({ ...v, notice: e.target.value })} /></label>
      <p className="text-xs text-muted-foreground">مثال: نسبة 5% وسحب 100$ = رسوم 5$.</p>
      <button onClick={save} className="btn-primary px-4 py-2 rounded-lg font-bold text-sm">حفظ</button>
    </div>
  );
}
