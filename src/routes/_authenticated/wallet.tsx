import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, RefreshCw, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet")({ component: WalletCard });

function WalletCard() {
  const [profile, setProfile] = useState<any>(null);
  const [pkg, setPkg] = useState<any>(null);
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: p } = await supabase.from("profiles")
      .select("*,packages(name,daily_rate,price)")
      .eq("id", u.user.id).maybeSingle();
    setProfile(p);
    setPkg((p as any)?.packages ?? null);
    setUpdatedAt(new Date());
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    let channel: any;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      channel = supabase.channel("wallet-" + data.user.id)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${data.user.id}` }, () => load())
        .subscribe();
    });
    return () => { clearInterval(t); if (channel) supabase.removeChannel(channel); };
  }, []);

  const bal = Number(profile?.balance ?? 0);

  return (
    <div className="min-h-screen p-4 flex flex-col">
      <header className="flex items-center justify-between mb-4">
        <Link to="/dashboard" className="flex items-center gap-1 text-sm glass px-3 py-1.5 rounded-lg">
          <ArrowLeft className="w-4 h-4" /> عودة
        </Link>
        <button onClick={load} className="glass p-2 rounded-lg" aria-label="refresh"><RefreshCw className="w-4 h-4" /></button>
      </header>

      <div className="flex-1 grid place-items-center">
        <div className="w-full max-w-sm">
          <div className="relative rounded-3xl p-6 text-white shadow-2xl overflow-hidden"
               style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 45%,#7c3aed 100%)" }}>
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-20 -left-10 w-60 h-60 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-white/20 grid place-items-center font-black">P</div>
                  <div className="font-extrabold tracking-widest">polone</div>
                </div>
                <Wallet className="w-6 h-6 opacity-80" />
              </div>

              <div className="mt-8 text-white/70 text-xs">رصيد النقاط</div>
              <div className="text-5xl font-black tracking-tight mt-1">
                ${bal.toFixed(2)}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="text-white/60">حامل البطاقة</div>
                  <div className="font-bold truncate mt-0.5">{profile?.full_name ?? profile?.email ?? "—"}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="text-white/60">معرّف الحساب</div>
                  <div className="font-black tracking-[0.3em] mt-0.5">{profile?.referral_code ?? "—"}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="text-white/60">الباقة</div>
                  <div className="font-bold mt-0.5">{pkg?.name ?? "—"}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="text-white/60">الربح اليومي</div>
                  <div className="font-bold mt-0.5">${Number(pkg?.daily_rate ?? 0).toFixed(2)}+</div>
                </div>
              </div>

              <div className="mt-4 text-[10px] text-white/60 text-left">
                آخر تحديث: {updatedAt.toLocaleTimeString("ar-EG")}
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 mt-4 text-xs leading-6">
            <div className="font-bold text-primary mb-1">💡 حفظ البطاقة على شاشة الآيفون</div>
            افتح هذه الصفحة في Safari، اضغط زر <b>المشاركة</b> (المربع مع السهم)، ثم اختر
            <b> "إضافة إلى الشاشة الرئيسية" </b>. ستظهر البطاقة كتطبيق مستقل ويتحدث الرصيد
            تلقائياً كلما زاد ربحك اليومي.
          </div>
        </div>
      </div>
    </div>
  );
}
