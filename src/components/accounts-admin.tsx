import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listAccountsActivity, deleteAccounts, cleanupInactiveAccounts } from "@/lib/admin.functions";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("ar") : "—");

export function AccountsAdmin({ onlyActive = false }: { onlyActive?: boolean }) {
  const list = useServerFn(listAccountsActivity);
  const del = useServerFn(deleteAccounts);
  const cleanup = useServerFn(cleanupInactiveAccounts);
  const [rows, setRows] = useState<any[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await list();
    setRows(r.accounts);
    setEnabled(r.cleanupEnabled);
    return r;
  };

  useEffect(() => {
    load().then(async r => {
      if (r.cleanupEnabled && !onlyActive) {
        const c = await cleanup();
        if (c.deleted) { toast.success(`تم حذف ${c.deleted} حساب غير مفعل`); load(); }
      }
    }).catch(e => toast.error(e.message));
  }, [onlyActive]);

  const toggle = async () => {
    const v = !enabled;
    await supabase.from("settings").upsert({ key: "inactive_cleanup_enabled", value: String(v) });
    setEnabled(v);
    toast.success(v ? "تم تفعيل الحذف التلقائي" : "تم إيقاف الحذف التلقائي");
  };

  const runCleanup = async () => {
    if (!confirm("حذف كل الحسابات غير المفعلة التي مر عليها 40 يوماً؟")) return;
    setBusy(true);
    try { const c = await cleanup(); toast.success(`تم حذف ${c.deleted} حساب`); await load(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا الحساب نهائياً؟")) return;
    try { await del({ data: { ids: [id] } }); toast.success("تم الحذف"); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const notify = async (id: string) => {
    const message = prompt("اكتب نص الإشعار لهذا الحساب")?.trim();
    if (!message) return;
    const { error } = await (supabase as any).from("notifications").insert({ target_user_id: id, message });
    if (error) toast.error(error.message); else toast.success("تم إرسال الإشعار");
  };

  const shown = rows
    .filter(r => !onlyActive || r.is_active)
    .filter(r => !q || [r.full_name, r.email, r.referral_code].some((v: string) => v?.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-3">
      {!onlyActive && (
        <div className="glass rounded-xl p-3 space-y-2">
          <div className="font-bold">حذف الحسابات غير المفعلة بعد 40 يوماً</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={toggle} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${enabled ? "btn-primary" : "glass"}`}>
              {enabled ? "الحذف التلقائي: مفعل" : "الحذف التلقائي: متوقف"}
            </button>
            <button disabled={busy} onClick={runCleanup} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-destructive text-destructive-foreground">حذف الآن</button>
          </div>
        </div>
      )}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم أو البريد أو المعرف" className="w-full glass rounded-lg px-3 py-2 text-sm" />
      <div className="text-xs text-muted-foreground">العدد: {shown.length}</div>
      {shown.map(r => (
        <div key={r.id} className="glass rounded-xl p-3 text-sm space-y-1">
          <div className="flex justify-between gap-2">
            <div className="font-bold">{r.full_name || r.email} <span className="text-muted-foreground">#{r.referral_code}</span></div>
            <span className={r.is_active ? "text-success" : "text-muted-foreground"}>{r.is_active ? "مفعل" : "غير مفعل"}</span>
          </div>
          <div className="text-xs text-muted-foreground">{r.email} · الرصيد {Number(r.balance).toFixed(2)} · التسجيل {fmt(r.created_at)}</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div>آخر إيداع: {fmt(r.last_deposit)}</div>
            <div>آخر سحب: {fmt(r.last_withdrawal)}</div>
            <div>آخر ربح يومي: {fmt(r.last_yield)}</div>
            <div>آخر حركة: {fmt(r.last_activity)}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => notify(r.id)} className="text-xs btn-primary px-2 py-1 rounded">إرسال إشعار</button>
          <button onClick={() => remove(r.id)} className="text-xs bg-destructive/90 text-destructive-foreground px-2 py-1 rounded">حذف الحساب</button>
          </div>
        </div>
      ))}
    </div>
  );
}
