import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ShieldCheck, TrendingUp, Users, Wallet, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitch, useLang, t } from "@/components/language-switch";
import { HelpButton } from "@/components/help-button";


export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Polone — عقود إلكترونية مربحة" },
      { name: "description", content: "polone منصة عالمية معتمدة من أكثر الشركات العالمية للربح الثابت، إيداع وسحب فوري ودعم كل المحافظ الإلكترونية." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const lang = useLang();
  return (
    <div className="min-h-screen" translate="no" suppressHydrationWarning>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
        <HelpButton />
        <LanguageSwitch />
      </div>

      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto pt-14">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl btn-primary grid place-items-center font-black" translate="no">P</div>
          <span className="text-xl font-extrabold tracking-tight" translate="no" suppressHydrationWarning>polone</span>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link to="/auth/login" className="px-4 py-2 rounded-lg hover:bg-secondary transition">{t("nav_login", lang)}</Link>
          <Link to="/auth/signup" className="btn-primary px-4 py-2 rounded-lg font-semibold">{t("nav_signup", lang)}</Link>
        </nav>
      </header>

      <section className="relative px-6 pt-10 pb-24 max-w-6xl mx-auto text-center">
        <span className="inline-block glass px-4 py-1.5 rounded-full text-xs text-primary mb-6">{t("hero_badge", lang)}</span>
        <h1 className="text-5xl md:text-7xl font-black leading-tight">
          <span translate="no" suppressHydrationWarning>polone</span><br/>
          <span className="text-gradient">{t("hero_title_2", lang)}</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">{t("hero_desc", lang)}</p>
        <div className="mt-10 flex gap-3 justify-center">
          <Link to="/auth/signup" className="btn-primary px-8 py-4 rounded-2xl font-bold inline-flex items-center gap-2">
            {t("cta_start", lang)} <ArrowLeft className="w-4 h-4" />
          </Link>
          <Link to="/auth/login" className="glass px-8 py-4 rounded-2xl font-bold">{t("cta_have", lang)}</Link>
        </div>
      </section>


      <section className="px-6 pb-20 max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { i: TrendingUp, t: t("f1_t", lang), d: t("f1_d", lang) },
          { i: Users, t: t("f2_t", lang), d: t("f2_d", lang) },
          { i: Wallet, t: t("f3_t", lang), d: t("f3_d", lang) },
          { i: ShieldCheck, t: t("f4_t", lang), d: t("f4_d", lang) },
        ].map((f, i) => (
          <div key={i} className="glass rounded-2xl p-6">
            <f.i className="w-7 h-7 text-primary mb-3" />
            <div className="font-bold">{f.t}</div>
            <div className="text-sm text-muted-foreground mt-1">{f.d}</div>
          </div>
        ))}
      </section>

      <section className="px-6 pb-20 max-w-6xl mx-auto">
        <h2 className="text-3xl font-extrabold text-center mb-3">{t("packages_title", lang)}</h2>
        <p className="text-center text-muted-foreground mb-10 text-sm">{t("packages_sub", lang)}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { p: 79, r: "3.2+ USDT", n: t("pkg_1", lang) },
            { p: 130, r: "7.5+ USDT", n: t("pkg_2", lang) },
            { p: 339, r: "16.2+ USDT", n: t("pkg_3", lang) },
            { p: 1355, r: "75.8+ USDT", n: t("pkg_4", lang), best: true },
          ].map((b: any, i) => (
            <div key={i} className={`relative glass rounded-2xl p-6 text-center hover:scale-105 transition ${b.best ? "ring-2 ring-primary" : ""}`}>
              {b.best && <span className="absolute -top-3 left-1/2 -translate-x-1/2 btn-primary px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap">{t("pkg_best", lang)}</span>}
              <div className="text-sm text-muted-foreground">{b.n}</div>
              <div className="text-4xl font-black mt-2">${b.p}</div>
              <div className="mt-3 text-gradient text-xl font-bold">{b.r} {t("pkg_daily", lang)}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border">
        © polone {new Date().getFullYear()}
      </footer>
    </div>
  );
}
