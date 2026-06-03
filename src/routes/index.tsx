import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ShieldCheck, TrendingUp, Users, Wallet, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Polone — منصة التداول الذكي" },
      { name: "description", content: "polone منصة تداول تلقائي بأرباح يومية حتى 2.3% ونظام إحالات." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl btn-primary grid place-items-center font-black">P</div>
          <span className="text-xl font-extrabold tracking-tight">polone</span>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link to="/auth/login" className="px-4 py-2 rounded-lg hover:bg-secondary transition">دخول</Link>
          <Link to="/auth/signup" className="btn-primary px-4 py-2 rounded-lg font-semibold">إنشاء حساب</Link>
        </nav>
      </header>

      <section className="px-6 pt-16 pb-24 max-w-6xl mx-auto text-center">
        <span className="inline-block glass px-4 py-1.5 rounded-full text-xs text-primary mb-6">منصة تداول ذكي • يومياً 24س</span>
        <h1 className="text-5xl md:text-7xl font-black leading-tight">
          استثمر بذكاء.<br/>
          <span className="text-gradient">اربح يومياً تلقائياً.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          polone يوفر لك نظام تداول آلي يضاعف رصيدك كل 24 ساعة بنسب تصل إلى 2.3% حسب باقتك، مع نظام إحالات يرفع نسبتك 0.5% لكل صديق.
        </p>
        <div className="mt-10 flex gap-3 justify-center">
          <Link to="/auth/signup" className="btn-primary px-8 py-4 rounded-2xl font-bold inline-flex items-center gap-2">
            ابدأ الآن <ArrowLeft className="w-4 h-4" />
          </Link>
          <Link to="/auth/login" className="glass px-8 py-4 rounded-2xl font-bold">لدي حساب</Link>
        </div>
      </section>

      <section className="px-6 pb-20 max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { i: TrendingUp, t: "ربح يومي حتى 2.3%", d: "حسب نوع باقتك" },
          { i: Users, t: "+0.5% لكل إحالة", d: "كلما زادت إحالاتك زاد ربحك" },
          { i: Wallet, t: "محفظة رقمية كاملة", d: "إيداع، سحب، تحويل، تسوق" },
          { i: ShieldCheck, t: "موافقات أدمن", d: "حماية لكل عملية مالية" },
        ].map((f, i) => (
          <div key={i} className="glass rounded-2xl p-6">
            <f.i className="w-7 h-7 text-primary mb-3" />
            <div className="font-bold">{f.t}</div>
            <div className="text-sm text-muted-foreground mt-1">{f.d}</div>
          </div>
        ))}
      </section>

      <section className="px-6 pb-20 max-w-6xl mx-auto">
        <h2 className="text-3xl font-extrabold text-center mb-10">باقات الاستثمار</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { p: 50, r: "1.0%" },
            { p: 100, r: "1.5%" },
            { p: 300, r: "2.0%" },
            { p: 900, r: "2.3%" },
          ].map((b, i) => (
            <div key={i} className="glass rounded-2xl p-6 text-center hover:scale-105 transition">
              <div className="text-sm text-muted-foreground">الباقة {i + 1}</div>
              <div className="text-4xl font-black mt-2">${b.p}</div>
              <div className="mt-3 text-gradient text-xl font-bold">{b.r} يومياً</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border">
        © polone {new Date().getFullYear()} — جميع الحقوق محفوظة
      </footer>
    </div>
  );
}
