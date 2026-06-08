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
      { title: "Polone — عقود إلكترونية مربحة" },
      { name: "description", content: "polone منصة عالمية للعقود الإلكترونية مع إيداع وسحب فوري ودعم المحافظ الإلكترونية." },
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
        <span className="inline-block glass px-4 py-1.5 rounded-full text-xs text-primary mb-6">منصة عالمية • عقود إلكترونية مربحة</span>
        <h1 className="text-5xl md:text-7xl font-black leading-tight">
          polone<br/>
          <span className="text-gradient">عقود إلكترونية مربحة.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          منصة عالمية تدعم الإيداع والسحب الفوري، وتعمل مع كل المحافظ الإلكترونية، مع نظام باقات واضح وإدارة آمنة للرصيد والطلبات.
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
          { i: TrendingUp, t: "عقود إلكترونية", d: "باقات يومية حسب الاشتراك" },
          { i: Users, t: "منصة عالمية", d: "واجهة عربية سهلة لكل العملاء" },
          { i: Wallet, t: "كل المحافظ الإلكترونية", d: "إيداع وسحب وتحويل داخلي" },
          { i: ShieldCheck, t: "إيداع وسحب فوري", d: "طلبات منظّمة ومراجعة آمنة" },
        ].map((f, i) => (
          <div key={i} className="glass rounded-2xl p-6">
            <f.i className="w-7 h-7 text-primary mb-3" />
            <div className="font-bold">{f.t}</div>
            <div className="text-sm text-muted-foreground mt-1">{f.d}</div>
          </div>
        ))}
      </section>

      <section className="px-6 pb-20 max-w-6xl mx-auto">
        <h2 className="text-3xl font-extrabold text-center mb-3">باقات الاستثمار</h2>
        <p className="text-center text-muted-foreground mb-10 text-sm">منصة عالمية • سحب وإيداع فوري • تدعم جميع المحافظ الإلكترونية</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { p: 90, r: "2.3 USDT", n: "الباقة 1" },
            { p: 130, r: "6.7 USDT", n: "الباقة 2" },
            { p: 320, r: "15.4 USDT", n: "الباقة 3" },
            { p: 985, r: "41.2 USDT", n: "الباقة 4" },
            { p: 1530, r: "67.1 USDT", n: "الأكثر ربحاً", best: true },
          ].map((b: any, i) => (
            <div key={i} className={`relative glass rounded-2xl p-6 text-center hover:scale-105 transition ${b.best ? "ring-2 ring-primary" : ""}`}>
              {b.best && <span className="absolute -top-3 left-1/2 -translate-x-1/2 btn-primary px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap">الأكثر ربحاً</span>}
              <div className="text-sm text-muted-foreground">{b.n}</div>
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
