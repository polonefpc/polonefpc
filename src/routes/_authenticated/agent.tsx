import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Send, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/agent")({ component: AgentPanel });

function AgentPanel() {
  const nav = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [balance, setBalance] = useState(0);
  const [toId, setToId] = useState("");
  const [amt, setAmt] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role","agent").maybeSingle();
    if (!r) { setAllowed(false); nav({ to: "/dashboard" }); return; }
    setAllowed(true);
    const { data: b } = await supabase.from("agent_balances").select("balance").eq("user_id", u.user.id).maybeSingle();
    setBalance(Number(b?.balance ?? 0));
    const { data: h } = await supabase.from("agent_grants").select("*,profiles!agent_grants_to_user_fkey(email)").eq("agent_id", u.user.id).order("created_at",{ascending:false}).limit(20);
    setHistory(h ?? []);
  };
  useEffect(()=>{load();},[]);

  const send = async () => {
    const a = Number(amt);
    if (!toId.trim()) return toast.error("أدخل معرّف حساب الزبون");
    if (!a || a <= 0) return toast.error("مبلغ غير صحيح");
    if (a > balance) return toast.error("رصيد الوكيل غير كافٍ. اطلب من الأدمن إضافة المزيد.");
    setLoading(true);
    const res = await agentGrantPoints({ data: { toCode: toId.trim(), amount: a } });
    setLoading(false);
    if (!res.ok) return toast.error(res.error ?? "فشل الإرسال");
    toast.success("تم إرسال النقاط فوراً");
    setToId(""); setAmt(""); load();
  };

  const logout = async () => { await supabase.auth.signOut(); nav({ to:"/" }); };

  if (allowed === null) return <div className="min-h-screen grid place-items-center">...</div>;

  return (
    <div className="min-h-screen">
      <header className="px-4 py-3 glass border-b flex items-center justify-between">
        <h1 className="font-extrabold">لوحة الوكيل</h1>
        <button onClick={logout} className="glass p-2 rounded-lg"><LogOut className="w-4 h-4" /></button>
      </header>
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="glass rounded-3xl p-6 text-center">
          <div className="text-xs text-muted-foreground">رصيد الوكيل المتاح</div>
          <div className="text-4xl font-black text-gradient mt-1">${balance.toFixed(2)}</div>
        </div>
        <div className="glass rounded-3xl p-6 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> إرسال نقاط لزبون</h2>
          <input className="w-full bg-input border border-border rounded-xl px-4 py-3 font-mono text-sm" placeholder="معرّف حساب الزبون" value={toId} onChange={e=>setToId(e.target.value)} />
          <input type="number" step="0.01" className="w-full bg-input border border-border rounded-xl px-4 py-3" placeholder="المبلغ" value={amt} onChange={e=>setAmt(e.target.value)} />
          <button disabled={loading} onClick={send} className="btn-primary w-full rounded-xl py-3 font-bold">{loading?"...":"إرسال فوري"}</button>
        </div>
        <div className="glass rounded-3xl p-5">
          <h3 className="font-bold mb-2">آخر العمليات</h3>
          {history.length === 0 ? <div className="text-sm text-muted-foreground">لا يوجد بعد</div> :
            <ul className="divide-y divide-border text-sm">
              {history.map(h=>(
                <li key={h.id} className="py-2 flex justify-between">
                  <span className="truncate">{h.profiles?.email ?? h.to_user.slice(0,8)}</span>
                  <span className="text-primary font-bold">${Number(h.amount).toFixed(2)}</span>
                </li>
              ))}
            </ul>}
        </div>
      </div>
    </div>
  );
}
