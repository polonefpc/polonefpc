import { useEffect, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { House as Home, ArrowDownLeft as ArrowDownToLine, ArrowUpRight as ArrowUpFromLine, MapPinned as MapPin, Layers3 as Package, UsersRound as Share2, LogOut, Crown, Shield, Eye, EyeOff, Copy, WalletCards as Wallet, AlertTriangle, Info, ChevronUp, ChevronDown, X, BellRing as Bell, Sparkles as Gift, Send } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@/lib/auth";
import { requestPackagePurchase, transferPoints } from "@/lib/trading.functions";
import { LanguageSwitch } from "@/components/language-switch";
import { HelpButton } from "@/components/help-button";
import { SupportChat } from "@/components/support-chat";
import { Button } from "@/components/ui/button";
import { requestWithdrawal } from "@/lib/withdrawal.functions";
import { BrandLogo } from "@/components/brand-logo";
import { RewardsClient } from "@/components/rewards-client";
import { TeamClient } from "@/components/team-client";
import { MarketIndicator, type SignalPoint } from "@/components/market-indicator";

type Tab = "home" | "deposit" | "withdraw" | "local" | "shop" | "referral" | "notifications" | "rewards" | "team";
const EARNING_LABELS: Record<string, string> = { yield: "ربح يومي", wheel: "ربح من عجلة الحظ", task: "مكافأة مهمة", welcome: "بونص ترحيبي", gift: "هدية المنصة", deposit: "إيداع", referral: "مكافأة الإحالات", agent: "شحن من وكيل", transfer: "تحويل مستلم", withdraw: "سحب" };

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "الرئيسية", icon: Home },
  { id: "deposit", label: "إيداع", icon: ArrowDownToLine },
  { id: "withdraw", label: "السحب", icon: ArrowUpFromLine },
  { id: "local", label: "إيداع محلي", icon: MapPin },
  { id: "shop", label: "الباقات", icon: Package },
  { id: "referral", label: "إحالة", icon: Share2 },
  { id: "rewards", label: "مكافآت", icon: Gift },
  { id: "notifications", label: "الإشعارات", icon: Bell },
];

export function ClientShell({ children, userEmail, roles }: { children: (tab: Tab) => React.ReactNode; userEmail: string; roles: Role[] }) {
  const [tab, setTab] = useState<Tab>("home");
  const [unread, setUnread] = useState(0);
  const [visibleTabs, setVisibleTabs] = useState<Record<Tab, boolean>>({
    home: true, deposit: true, withdraw: true, local: true, shop: true, referral: true, notifications: true, rewards: true, team: false,
  });
  const nav = useNavigate();

  useEffect(() => {
    supabase.from("settings").select("key,value").in("key", [
      "tab_deposit_visible", "tab_withdraw_visible", "tab_local_visible", "tab_shop_visible", "tab_referral_visible", "tab_rewards_visible", "tab_notifications_visible", "tab_team_visible",
    ]).then(({ data }) => {
      const values = Object.fromEntries((data ?? []).map(row => [row.key, row.value]));
      const next: Record<Tab, boolean> = {
        home: true,
        deposit: (values.tab_deposit_visible ?? "true") === "true",
        withdraw: (values.tab_withdraw_visible ?? "true") === "true",
        local: (values.tab_local_visible ?? "true") === "true",
        shop: (values.tab_shop_visible ?? "true") === "true",
        referral: (values.tab_referral_visible ?? "true") === "true",
        notifications: (values.tab_notifications_visible ?? "true") === "true",
        rewards: (values.tab_rewards_visible ?? "true") === "true",
        team: (values.tab_team_visible ?? "true") === "true",
      };
      setVisibleTabs(next);
      setTab(current => next[current] ? current : "home");
    });
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: rows } = await (supabase as any).from("notifications").select("id").or(`target_user_id.is.null,target_user_id.eq.${data.user.id}`).limit(200);
      let read: string[] = [];
      try { read = JSON.parse(localStorage.getItem(`notif_read_${data.user.id}`) ?? "[]"); } catch { read = []; }
      const seen = new Set(read);
      setUnread((rows ?? []).filter((r: any) => !seen.has(r.id)).length);
    });
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    nav({ to: "/" });
  };

  return (
    <div className="internal-app min-h-screen pb-24">
      <SupportChat />
      <header className="client-header sticky top-0 z-20 px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <BrandLogo className="h-8 w-8" />
        <div className="flex items-center gap-2">
          <HelpButton />
          <LanguageSwitch />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {roles.includes("admin") && (
            <Link to="/admin" className="glass px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-primary" /> أدمن
            </Link>
          )}
          {roles.includes("agent") && (
            <Link to="/agent" className="glass px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-primary" /> وكيل
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={logout} title="خروج" aria-label="خروج"><LogOut className="w-4 h-4" /></Button>
        </div>
      </header>

      <ClientNotifications />
      {visibleTabs.team && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <Button variant={tab === "team" ? "default" : "outline"} className="w-full" onClick={() => setTab(tab === "team" ? "home" : "team")}><Share2 />Team</Button>
        </div>
      )}

      <main key={tab} className="client-content max-w-2xl mx-auto px-4 py-4">{tab === "notifications" ? <NotificationsTab onRead={() => setUnread(0)} /> : tab === "rewards" ? <RewardsTab /> : tab === "team" ? <TeamClient /> : children(tab)}</main>

      <nav aria-label="أقسام الحساب" className="client-navigation fixed bottom-3 left-3 right-3 max-w-2xl mx-auto rounded-xl p-1.5 flex z-30">
        {TABS.filter(t => visibleTabs[t.id] && t.id !== "team").map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <Button variant="ghost" key={t.id} onClick={() => setTab(t.id)} aria-current={active ? "page" : undefined} title={t.label}
              className={`navigation-item relative h-14 min-w-16 flex-1 shrink-0 flex-col gap-1 rounded-lg px-1 py-2 ${active ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
              <Icon className="size-5" strokeWidth={active ? 2.2 : 1.7} />
              <span className="text-[10px] font-semibold">{t.label}</span>
              {t.id === "notifications" && unread > 0 && (
                <span className="absolute -top-1 right-0 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-black leading-4">{unread > 99 ? "99+" : unread}</span>
              )}
            </Button>
          );
        })}
      </nav>
    </div>
  );
}

function RewardsTab() {
  const [mode, setMode] = useState<"wheel" | "tasks">("wheel");
  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-3 flex gap-2">
        <Button onClick={() => setMode("wheel")} variant={mode === "wheel" ? "default" : "ghost"} className="flex-1"><Gift />عجلة الربح</Button>
        <Button onClick={() => setMode("tasks")} variant={mode === "tasks" ? "default" : "ghost"} className="flex-1"><Package />المهام</Button>
      </div>
      <RewardsClient key={mode} mode={mode} />
    </div>
  );
}

function ClientNotifications() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const [notices, dismissed] = await Promise.all([
        (supabase as any).from("notifications").select("id,message,created_at,target_user_id").or(`target_user_id.is.null,target_user_id.eq.${data.user.id}`).order("created_at", { ascending: false }).limit(20),
        (supabase as any).from("notification_dismissals").select("notification_id").eq("user_id", data.user.id),
      ]);
      const hidden = new Set((dismissed.data ?? []).map((row: any) => row.notification_id));
      if (active) setItems((notices.data ?? []).filter((notice: any) => !hidden.has(notice.id)));
    });
    return () => { active = false; };
  }, []);

  const dismiss = async (id: string) => {
    setItems(current => current.filter(item => item.id !== id));
    const { data } = await supabase.auth.getUser();
    if (data.user) await (supabase as any).from("notification_dismissals").upsert({ notification_id: id, user_id: data.user.id });
  };

  const current = items[0];
  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => dismiss(current.id), 10_000);
    return () => window.clearTimeout(timer);
  }, [current?.id]);

  if (!current) return null;
  return (
    <div className="notification-banner fixed top-3 left-3 right-3 z-50 mx-auto max-w-xl animate-slide-in-right" role="status">
      <div className="flex items-start gap-3 rounded-xl border border-primary/40 bg-popover px-4 py-3 shadow-2xl">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm font-bold" dir="auto">{current.message}</p>
        <button onClick={() => dismiss(current.id)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary" title="إغلاق الإشعار" aria-label="إغلاق الإشعار">
          <X className="h-4 w-4" />
        </button>
        <span className="notification-timer absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
      </div>
    </div>
  );
}

function NotificationsTab({ onRead }: { onRead: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: rows } = await (supabase as any).from("notifications").select("id,message,created_at").or(`target_user_id.is.null,target_user_id.eq.${data.user.id}`).order("created_at", { ascending: false }).limit(100);
      setItems(rows ?? []);
      localStorage.setItem(`notif_read_${data.user.id}`, JSON.stringify((rows ?? []).map((r: any) => r.id)));
      onRead();
    });
  }, []);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-black flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> الإشعارات</h2>
      {items.length === 0 && <div className="glass rounded-xl p-4 text-center text-sm text-muted-foreground">لا توجد إشعارات</div>}
      {items.map(n => (
        <div key={n.id} className="glass rounded-xl p-3">
          <p className="whitespace-pre-wrap text-sm font-bold" dir="auto">{n.message}</p>
          <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("ar")}</div>
        </div>
      ))}
    </div>
  );
}

function HomeAdvertisements() {
  const [items, setItems] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [touchY, setTouchY] = useState<number | null>(null);

  useEffect(() => {
    (supabase as any).from("advertisements").select("*").eq("is_active", true).order("sort_order").order("created_at")
      .then(({ data }: any) => setItems(data ?? []));
  }, []);

  const move = (delta: number) => setIndex(current => (current + delta + items.length) % items.length);
  if (!items.length) return null;
  const item = items[index];
  const content = (
    <>
      {item.image_url && <img src={item.image_url} alt={item.title || "إعلان Polone"} className="absolute inset-0 h-full w-full object-cover" />}
      <div className={`absolute inset-0 ${item.image_url ? "advertisement-overlay" : "bg-secondary"}`} />
      <div className="relative z-10 flex h-full flex-col justify-end p-5">
        {item.title && <h3 className="text-xl font-black">{item.title}</h3>}
        {item.body && <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90" dir="auto">{item.body}</p>}
      </div>
    </>
  );

  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-surface advertisement-frame"
      onTouchStart={event => setTouchY(event.touches[0]?.clientY ?? null)}
      onTouchEnd={event => {
        const endY = event.changedTouches[0]?.clientY;
        if (touchY === null || endY === undefined) return;
        if (touchY - endY > 35) move(1);
        if (endY - touchY > 35) move(-1);
        setTouchY(null);
      }}>
      {item.link_url ? <a href={item.link_url} target="_blank" rel="noreferrer" className="absolute inset-0">{content}</a> : <div className="absolute inset-0">{content}</div>}
      {items.length > 1 && (
        <div className="absolute left-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1">
          <button onClick={() => move(-1)} className="rounded-full bg-background/75 p-1.5 backdrop-blur" title="الإعلان السابق"><ChevronUp className="h-4 w-4" /></button>
          <button onClick={() => move(1)} className="rounded-full bg-background/75 p-1.5 backdrop-blur" title="الإعلان التالي"><ChevronDown className="h-4 w-4" /></button>
        </div>
      )}
      <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1">
        {items.map((_: any, i: number) => <span key={i} className={`h-1 rounded-full transition-all ${i === index ? "w-5 bg-primary" : "w-1.5 bg-foreground/40"}`} />)}
      </div>
    </section>
  );
}

export function useProfile() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [p, pkg, txs, refs, dep, wd, mrefs, logs] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.user.id).single(),
      supabase.from("packages").select("*").order("priority", { ascending: false }).order("id"),
      supabase.from("daily_yields").select("*").eq("user_id", u.user.id).order("applied_on",{ascending:false}).limit(30),
      supabase.from("profiles").select("id,email,full_name,created_at,is_active").eq("referred_by", u.user.id).order("created_at", { ascending: false }),
      supabase.from("deposit_requests").select("*").eq("user_id", u.user.id).order("created_at",{ascending:false}).limit(30),
      supabase.from("withdrawals").select("*").eq("user_id", u.user.id).order("created_at",{ascending:false}).limit(30),
      (supabase as any).from("manual_referrals").select("id,full_name,is_active,created_at").eq("user_id", u.user.id).order("created_at",{ascending:false}),
      supabase.from("earning_logs").select("*").eq("user_id", u.user.id).order("created_at",{ascending:false}).limit(200),
    ]);
    const yields = txs.data ?? [];
    const transactions = [
      ...(logs.data ?? []).map((l: any) => ({ id: `l-${l.id}`, kind: l.source, amount: Number(l.amount), at: l.created_at, status: null, note: l.note })),
      ...(dep.data ?? []).filter((d: any) => d.status !== "approved" && !d.package_id).map((d: any) => ({ id: `d-${d.id}`, kind: "deposit", amount: Number(d.amount), at: d.created_at, status: d.status })),
      ...(wd.data ?? []).map((w: any) => ({ id: `w-${w.id}`, kind: "withdraw", amount: Number(w.amount), at: w.created_at, status: w.status })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const allRefs = [
      ...(refs.data ?? []),
      ...((mrefs as any).data ?? []).map((m: any) => ({ id: `m-${m.id}`, email: null, full_name: m.full_name, created_at: m.created_at, is_active: m.is_active })),
    ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setData({ profile: p.data, packages: pkg.data ?? [], yields, transactions, refs: allRefs, user: u.user });
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);
  return { ...data, loading, reload };
}

// ───────── tabs ─────────
export function HomeTab({ profile, packages, refs, yields, transactions, reload }: any) {
  const pkg = packages.find((p: any) => p.id === profile?.package_id);
  const [showBal, setShowBal] = useState(false);
  const code = profile?.referral_code ?? "—";
  const copyCode = () => { if (profile?.referral_code) { navigator.clipboard.writeText(code); toast.success("تم نسخ رمز الإحالة"); } };

  // ─── تحدي الإحالة (قابل للتحكم من لوحة الأدمن) ───
  const [offer, setOffer] = useState<{ enabled: boolean; goal: number; reward: number; title: string } | null>(null);
  const [marketSignal, setMarketSignal] = useState<{ enabled: boolean; direction: "up" | "down"; text: string; value: string; history: SignalPoint[] } | null>(null);
  const GOAL = offer?.goal ?? 10;
  const REWARD = offer?.reward ?? 94;
  const refCount = Math.max(Number(profile?.referral_count ?? 0), refs?.length ?? 0);
  const progress = Math.min(refCount, GOAL);
  const pct = Math.round((progress / GOAL) * 100);
  const [claimed, setClaimed] = useState<boolean | null>(null);
  const shareUrl = typeof window !== "undefined" && profile?.referral_code
    ? `${window.location.origin}/auth/signup?ref=${profile.referral_code}` : "";

  useEffect(() => {
    supabase.from("settings").select("key,value")
      .in("key", ["referral_offer_enabled", "referral_offer_goal", "referral_offer_reward", "referral_offer_title", "market_signal_enabled", "market_signal_direction", "market_signal_text", "market_signal_value", "market_signal_history"])
      .then(({ data }) => {
        const m = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
        setOffer({
          enabled: (m.referral_offer_enabled ?? "true") === "true",
          goal: Number(m.referral_offer_goal ?? 10) || 10,
          reward: Number(m.referral_offer_reward ?? 94) || 94,
          title: m.referral_offer_title ?? "",
        });
        setMarketSignal({
          enabled: (m.market_signal_enabled ?? "false") === "true",
          direction: m.market_signal_direction === "down" ? "down" : "up",
          text: m.market_signal_text ?? "",
          value: m.market_signal_value ?? "",
          history: (() => { try { return JSON.parse(m.market_signal_history ?? "[]"); } catch { return []; } })(),
        });
      });
  }, []);

  useEffect(() => {
    if (!profile?.id || !offer?.enabled) return;
    supabase.from("referral_milestone_claims").select("user_id").eq("user_id", profile.id).maybeSingle()
      .then(({ data }) => {
        const has = !!data;
        setClaimed(has);
        if (!has && refCount >= GOAL) {
          supabase.rpc("claim_referral_milestone").then(({ data: r }) => {
            const row: any = Array.isArray(r) ? r[0] : r;
            if (row?.ok) {
              toast.success(`مبروك! تم إضافة $${Number(row.amount ?? REWARD)} إلى رصيدك 🎉`);
              setClaimed(true);
              reload?.();
            }
          });
        }
      });
  }, [profile?.id, refCount, offer?.enabled, GOAL]);


  const copyShare = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    toast.success("تم نسخ رابط الإحالة");
  };

  return (
    <div className="space-y-4">
      {/* رمز الإحالة خارج المستطيل من الأعلى */}
      <div className="flex items-center justify-between glass rounded-2xl px-4 py-3">
        <div>
          <div className="text-[11px] text-muted-foreground">رمز الإحالة / معرّف الحساب</div>
          <div className="font-black text-xl tracking-[0.4em] text-primary select-all mt-0.5">{code}</div>
        </div>
        <button onClick={copyCode} className="glass p-2 rounded-lg" title="نسخ">
          <Copy className="w-4 h-4 text-primary" />
        </button>
      </div>

      {marketSignal?.enabled && (
        <div className={`market-signal -mt-2 text-center ${marketSignal.direction === "up" ? "market-signal-up" : "market-signal-down"}`}>
          <MarketIndicator direction={marketSignal.direction} history={marketSignal.history} value={marketSignal.value} />
          {marketSignal.text.trim() && <div className="-mt-1 whitespace-pre-wrap text-lg font-black" dir="auto">{marketSignal.text}</div>}
        </div>
      )}

      <HomeAdvertisements />

      {/* مستطيل الملف التعريفي */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground">المحفظة الرقمية</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className="text-3xl font-black text-gradient leading-none">
                {showBal ? `$${Number(profile?.balance ?? 0).toFixed(2)}` : "******"}
              </div>
              <button
                onClick={() => setShowBal(s => !s)}
                className="p-1.5 rounded-md hover:bg-secondary/60 text-muted-foreground"
                title={showBal ? "إخفاء" : "إظهار"}
                aria-label="toggle balance"
              >
                {showBal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <Link to="/wallet" className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg btn-primary text-[11px] font-bold">
                <Wallet className="w-3.5 h-3.5" /> فتح المحفظة
              </Link>
            </div>
          </div>
          <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold ${profile?.is_active ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
            {profile?.is_active ? "مفعّل" : "غير مفعّل"}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div className="bg-secondary/50 rounded-xl p-3">
            <div className="text-muted-foreground text-[11px]">الاسم</div>
            <div className="font-bold mt-0.5 truncate text-sm">{profile?.full_name ?? "—"}</div>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <div className="text-muted-foreground text-[11px]">الباقة</div>
            <div className="font-bold mt-0.5 truncate text-sm">{pkg ? pkg.name : "—"}</div>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <div className="text-muted-foreground text-[11px]">الإحالات</div>
            <div className="font-bold mt-0.5 text-sm">{Math.max(Number(profile?.referral_count ?? 0), refs.length)}</div>
          </div>
        </div>
      </div>


      {/* تحدي الإحالة */}
      {offer?.enabled && (
      <div className="glass rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xs text-muted-foreground">تحدي الإحالة</div>
            <h3 className="font-extrabold text-base mt-0.5">{offer.title?.trim() ? offer.title : <>ادعُ {GOAL} أشخاص واربح <span className="text-primary">{REWARD} USDT</span></>}</h3>
          </div>

          <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${claimed ? "bg-success/20 text-success" : "bg-primary/15 text-primary"}`}>
            {claimed ? "تم الاستلام" : `${progress}/${GOAL}`}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-secondary/60 overflow-hidden">
          <div className="h-full btn-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 min-w-0 bg-background/40 rounded-lg px-3 py-2 text-[11px] font-mono truncate select-all">
            {shareUrl || "—"}
          </div>
          <button onClick={copyShare} className="btn-primary rounded-lg px-3 py-2 text-xs font-bold inline-flex items-center gap-1">
            <Copy className="w-3.5 h-3.5" /> نسخ
          </button>
        </div>
        {claimed && <p className="text-[11px] text-success mt-2">تم إضافة المكافأة إلى رصيدك.</p>}
        {!claimed && refCount >= GOAL && <p className="text-[11px] text-primary mt-2">جارٍ إضافة المكافأة…</p>}
      </div>
      )}


      <div className="glass rounded-3xl p-5">
        <h3 className="font-bold mb-1">سجل الأرباح والمعاملات</h3>
        <p className="text-[11px] text-muted-foreground mb-3">يُحفظ السجل لمدة 45 يوماً.</p>
        {(!transactions || transactions.length === 0) ? <div className="text-sm text-muted-foreground">لا توجد معاملات بعد.</div> :
          <ul className="text-sm divide-y divide-border">
            {transactions.map((t: any) => {
              const label = EARNING_LABELS[t.kind] ?? t.kind;
              const color = t.kind === "withdraw" ? "text-destructive" : t.kind === "deposit" && t.status ? "text-foreground" : "text-success";
              const sign = t.kind === "withdraw" ? "−" : "+";
              const st = t.status === "pending" ? " (قيد المراجعة)" : t.status === "fee_pending" ? " (بانتظار تأكيد الرسوم)" : t.status === "rejected" ? " (مرفوض)" : "";
              return (
                <li key={t.id} className="flex justify-between py-2 gap-2">
                  <span className="min-w-0">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground text-xs">{st}</span>
                    {t.note && <span className="block text-[11px] text-muted-foreground truncate">{t.note}</span>}
                    <span className="block text-[11px] text-muted-foreground">
                      {new Date(t.at).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </span>
                  <span className={`${color} font-bold whitespace-nowrap`}>
                    {showBal ? `${sign}$${Number(t.amount).toFixed(2)}` : `${sign}$***`}
                  </span>
                </li>
              );
            })}
          </ul>}
      </div>
    </div>
  );
}




export function DepositTab({ reload }: any) {
  const [amount, setAmount] = useState("");
  const [tx, setTx] = useState("");
  const [wallets, setWallets] = useState<any[]>([]);
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [mine, setMine] = useState<any[]>([]);

  const loadMine = () => supabase.auth.getUser().then(({ data: u }) => {
    if (u.user) supabase.from("deposit_requests").select("*").eq("user_id", u.user.id).order("created_at",{ascending:false}).then(({data})=>setMine(data ?? []));
  });

  useEffect(() => {
    supabase.from("deposit_wallets").select("*").eq("is_active", true).order("sort_order").then(({data})=>setWallets(data ?? []));
    supabase.from("settings").select("*").eq("key","deposit_description").maybeSingle().then(({data})=>setDesc(data?.value ?? ""));
    loadMine();
  }, []);

  const submit = async () => {
    const a = Number(amount);
    if (!a || a <= 0) { toast.error("أدخل قيمة الإيداع"); return; }
    if (!tx || tx.trim().length < 6) { toast.error("أدخل رقم عملية التحويل (TX Hash) لإرسال الطلب"); return; }
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("deposit_requests").insert({ user_id: u.user!.id, amount: a, tx_hash: tx.trim(), package_id: null as any });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إرسال طلب الإيداع. بانتظار موافقة الأدمن.");
    setTx(""); setAmount(""); reload(); loadMine();
  };

  const copy = (addr: string) => { navigator.clipboard.writeText(addr); toast.success("تم النسخ"); };

  return (
    <div className="space-y-4">
      <div className="glass rounded-3xl p-6">
        <h2 className="text-xl font-extrabold">إيداع رصيد</h2>
        {desc && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{desc}</p>}
      </div>

      <div className="space-y-3">
        {wallets.length === 0 && <div className="glass rounded-2xl p-6 text-center text-muted-foreground text-sm">لم تتم إضافة محافظ بعد</div>}
        {wallets.map(w => (
          <div key={w.id} className="glass rounded-2xl p-4">
            <div className="flex items-start gap-3">
              {w.image_url ? (
                <img src={w.image_url} alt={w.label} className="w-14 h-14 rounded-xl object-cover bg-background/40 shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-background/40 grid place-items-center text-xs text-muted-foreground shrink-0">{w.currency ?? "—"}</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{w.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                      {w.currency && <span className="text-primary font-bold">{w.currency}</span>}
                      {w.network && <span>{w.network}</span>}
                    </div>
                  </div>
                  <button onClick={()=>copy(w.address)} className="text-xs text-primary font-bold shrink-0">نسخ</button>
                </div>
              </div>
            </div>
            <div className="font-mono text-xs mt-3 break-all select-all bg-background/40 p-3 rounded-lg">{w.address}</div>
          </div>
        ))}

        {/* روابط تطبيقات المحافظ */}
        <div className="glass rounded-2xl p-4">
          <div className="text-[11px] text-muted-foreground mb-2 text-center">فتح تطبيق المحفظة</div>
          <div className="flex items-center justify-center gap-4">
            <a href="okx://" onClick={(e) => { e.preventDefault(); const t = Date.now(); const back = () => Date.now() - t < 1500 && window.open("https://www.okx.com/download", "_blank"); setTimeout(back, 800); window.location.href = "okx://"; }}
               className="flex flex-col items-center gap-1.5 group">
              <div className="w-14 h-14 rounded-2xl bg-black grid place-items-center shadow-lg group-active:scale-95 transition">
                <svg viewBox="0 0 32 32" className="w-8 h-8" fill="white"><path d="M4 4h8v8H4V4zm16 0h8v8h-8V4zM12 12h8v8h-8v-8zM4 20h8v8H4v-8zm16 0h8v8h-8v-8z"/></svg>
              </div>
              <span className="text-[10px] font-bold">OKX</span>
            </a>
            <a href="bnc://app.binance.com/" onClick={(e) => { e.preventDefault(); const t = Date.now(); const back = () => Date.now() - t < 1500 && window.open("https://www.binance.com/en/download", "_blank"); setTimeout(back, 800); window.location.href = "bnc://app.binance.com/"; }}
               className="flex flex-col items-center gap-1.5 group">
              <div className="w-14 h-14 rounded-2xl bg-[#F0B90B] grid place-items-center shadow-lg group-active:scale-95 transition">
                <svg viewBox="0 0 32 32" className="w-8 h-8" fill="black"><path d="M9.3 13.5L16 6.8l6.7 6.7 3.9-3.9L16 -1l-10.6 10.6 3.9 3.9zM2 16l3.9-3.9L9.8 16l-3.9 3.9L2 16zm7.3 2.5L16 25.2l6.7-6.7 3.9 3.9L16 33 5.4 22.4l3.9-3.9zM22.2 16l3.9-3.9L30 16l-3.9 3.9L22.2 16zm-2.3 0L16 12.1 12.1 16l3.9 3.9L19.9 16z"/></svg>
              </div>
              <span className="text-[10px] font-bold">Binance</span>
            </a>
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl p-6 space-y-3">
        <h3 className="font-bold">تفاصيل طلب الإيداع</h3>
        <input type="number" step="0.01" min={1} className="w-full bg-input border border-border rounded-xl px-4 py-3"
          placeholder="المبلغ بالـ USDT" value={amount} onChange={e => setAmount(e.target.value)} />
        <input className="w-full bg-input border border-border rounded-xl px-4 py-3"
          placeholder="رقم عملية التحويل / TX Hash (مطلوب)" value={tx} onChange={e => setTx(e.target.value)} />
        <button disabled={loading} onClick={submit} className="btn-primary w-full rounded-xl py-3 font-bold">
          {loading ? "..." : "إرسال طلب الإيداع"}
        </button>
        <p className="text-[11px] text-muted-foreground">لشراء باقة تداول: ادفع رصيدك من تبويب «الباقات».</p>
      </div>

      {mine.length > 0 && (
        <div className="glass rounded-3xl p-5">
          <h3 className="font-bold mb-2">طلباتي</h3>
          <ul className="divide-y divide-border text-sm">
            {mine.map((r:any)=>(
              <li key={r.id} className="py-2 flex justify-between">
                <span>${Number(r.amount).toFixed(2)}</span>
                <span className={`text-xs px-2 py-1 rounded ${r.status==="approved"?"bg-success/20 text-success":r.status==="rejected"?"bg-destructive/20 text-destructive":"bg-muted text-muted-foreground"}`}>
                  {r.status === "approved" ? "مقبول" : r.status === "rejected" ? "مرفوض" : "قيد المراجعة"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


const NETWORKS: Record<string, { label: string; currencies: string[] }> = {
  TRON: { label: "TRON · TRC20", currencies: ["USDT", "TRX"] },
  BNB: { label: "BNB Smart Chain · BEP20", currencies: ["USDT", "USDC", "BNB"] },
  ETHEREUM: { label: "Ethereum · ERC20", currencies: ["USDT", "USDC", "ETH"] },
  SOLANA: { label: "Solana · SPL", currencies: ["USDT", "USDC", "SOL"] },
};

export function WithdrawTab({ profile, reload }: any) {
  const [mode, setMode] = useState<"withdraw" | "transfer" | null>(null);
  const [wallet, setWallet] = useState("");
  const [toCode, setToCode] = useState("");
  const [amt, setAmt] = useState("");
  const [currency, setCurrency] = useState("USDT");
  const [network, setNetwork] = useState<"TRON" | "BNB" | "ETHEREUM" | "SOLANA">("TRON");
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [feeStep, setFeeStep] = useState(false);
  const [feeTx, setFeeTx] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const requestWithdrawalFn = useServerFn(requestWithdrawal);
  const transferPointsFn = useServerFn(transferPoints);
  const active = !!profile?.is_active;
  const pct = Math.max(0, Number(cfg.withdraw_fee_percent ?? 0) || 0);
  const a = Number(amt) || 0;
  const feeAmount = Math.round(a * pct) / 100;
  const tMin = Number(cfg.transfer_min) || 0, tMax = Number(cfg.transfer_max) || 0;

  useEffect(() => {
    supabase.from("settings").select("key,value").in("key", ["withdraw_description", "withdraw_fee_percent", "withdraw_fee_wallet", "withdraw_fee_notice", "withdraw_fee_image", "transfer_min", "transfer_max"])
      .then(({ data }) => setCfg(Object.fromEntries((data ?? []).map(r => [r.key, r.value]))));
  }, []);
  useEffect(() => { if (!NETWORKS[network].currencies.includes(currency)) setCurrency(NETWORKS[network].currencies[0]); }, [network]);

  const copy = async (v: string) => { try { await navigator.clipboard.writeText(v); toast.success("تم النسخ"); } catch { toast.error("تعذر النسخ"); } };

  const validateWithdraw = () => {
    if (!active) { toast.error("حسابك غير مفعّل — لا يمكن السحب"); return; }
    if (!a || a < 49) { toast.error("الحد الأدنى للسحب 49$"); return; }
    if (wallet.trim().length < 20) { toast.error("أدخل عنوان محفظة صحيح"); return; }
    if (a > Number(profile?.balance ?? 0)) { toast.error("رصيد غير كافٍ"); return; }
    if (pct > 0) { setFeeTx(""); setFeeStep(true); } else void sendWithdraw("");
  };

  const sendWithdraw = async (tx: string) => {
    if (tx && tx.trim().length < 6) { toast.error("أدخل رقم معاملة الرسوم"); return; }
    setLoading(true);
    try {
      const result = await requestWithdrawalFn({ data: { amount: a, wallet: wallet.trim(), network, currency: currency as any, feeTx: tx.trim() || undefined } });
      if (!result.ok) { toast.error(result.error); return; }
      setFeeStep(false);
      setDone(tx ? "تم إرسال الرسوم وطلب السحب — بانتظار تأكيد الإدارة" : "تم إرسال طلب السحب — قيد المراجعة");
      toast.success("تم إرسال طلب السحب");
      setWallet(""); setAmt(""); reload();
    } catch { toast.error("تعذر إرسال طلب السحب، تحقق من الاتصال وحاول مجدداً"); }
    finally { setLoading(false); }
  };

  const submitTransfer = async () => {
    if (!active) { toast.error("حسابك غير مفعّل — لا يمكن التحويل"); return; }
    if (!a || a <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    if (tMin > 0 && a < tMin) { toast.error(`الحد الأدنى للتحويل ${tMin}$`); return; }
    if (tMax > 0 && a > tMax) { toast.error(`الحد الأقصى للتحويل ${tMax}$`); return; }
    if (a > Number(profile?.balance ?? 0)) { toast.error("رصيد غير كافٍ"); return; }
    if (!/^\d{5}$/.test(toCode.trim())) { toast.error("أدخل رقم حساب من 5 أرقام"); return; }
    setLoading(true);
    const result = await transferPointsFn({ data: { toCode: toCode.trim(), amount: a } });
    setLoading(false);
    if (!result.ok) { toast.error(result.error); return; }
    toast.success("تم التحويل");
    setAmt(""); setToCode(""); reload();
  };

  const field = "w-full bg-input border border-border rounded-xl px-4 py-3";
  return (
    <div className="space-y-4">
      {!active && <div className="glass rounded-2xl p-4 border border-destructive/40 text-sm text-destructive">حسابك غير مفعّل. لا يمكنك السحب أو التحويل قبل تفعيل باقة من «الباقات».</div>}
      <div className="glass rounded-3xl p-6">
        <div className="text-xs text-muted-foreground">رصيدك الحالي</div>
        <div className="text-3xl font-black text-gradient">${Number(profile?.balance ?? 0).toFixed(2)}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(["transfer", "withdraw"] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setDone(null); setAmt(""); }} className={`glass rounded-2xl p-5 flex flex-col items-center gap-2 font-bold transition ${mode === m ? "ring-2 ring-primary" : ""}`}>
            {m === "withdraw" ? <ArrowUpFromLine className="w-7 h-7 text-primary" /> : <Send className="w-7 h-7 text-primary" />}
            {m === "withdraw" ? "السحب" : "التحويل"}
          </button>
        ))}
      </div>

      {mode === "withdraw" && <div className="glass rounded-3xl p-6 space-y-3">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span className="font-bold">تأكد أن الشبكة والعملة مطابقتان لمحفظتك.</span></div>
        {cfg.withdraw_description && <p className="rounded-xl bg-secondary/40 px-4 py-3 text-xs leading-6 text-muted-foreground whitespace-pre-line">{cfg.withdraw_description}</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1 text-sm"><span>الشبكة</span><select aria-label="الشبكة" className="reward-input" value={network} onChange={e => setNetwork(e.target.value as typeof network)}>{Object.entries(NETWORKS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <label className="block space-y-1 text-sm"><span>العملة</span><select aria-label="العملة" className="reward-input" value={currency} onChange={e => setCurrency(e.target.value)}>{NETWORKS[network].currencies.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
        <input aria-label="رقم المحفظة" dir="ltr" className={field} placeholder="رقم المحفظة" value={wallet} onChange={e => setWallet(e.target.value)} />
        <input aria-label="المبلغ" type="number" step="0.01" min={49} className={field} placeholder="المبلغ (الحد الأدنى 49$)" value={amt} onChange={e => setAmt(e.target.value)} />
        <Button disabled={loading || !active} onClick={validateWithdraw} className="w-full h-12">{loading ? "جارٍ الإرسال…" : "إرسال طلب السحب"}</Button>
        {done && <div role="status" className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm font-bold text-success">{done}</div>}
      </div>}

      {mode === "transfer" && <div className="glass rounded-3xl p-6 space-y-3">
        <input aria-label="رقم الحساب" inputMode="numeric" maxLength={5} className={`${field} text-center tracking-widest text-lg font-bold`} placeholder="رقم الحساب (5 أرقام)" value={toCode} onChange={e => setToCode(e.target.value.replace(/\D/g, ""))} />
        <input aria-label="مبلغ التحويل" type="number" step="0.01" min={tMin || 0.01} className={field} placeholder="المبلغ" value={amt} onChange={e => setAmt(e.target.value)} />
        {(tMin > 0 || tMax > 0) && <p className="text-xs text-muted-foreground">{tMin > 0 && `الحد الأدنى ${tMin}$`}{tMin > 0 && tMax > 0 && " · "}{tMax > 0 && `الحد الأقصى ${tMax}$`}</p>}
        <Button disabled={loading || !active} onClick={submitTransfer} className="w-full h-12">{loading ? "جارٍ التحويل…" : "تحويل"}</Button>
      </div>}

      {feeStep && <div role="dialog" aria-modal aria-label="رسوم السحب" className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
        <div className="glass w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl p-5 space-y-3 text-sm">
          <h3 className="text-lg font-black">رسوم عملية السحب</h3>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary/40 p-3"><span>المبلغ</span><b className="text-end">${a.toFixed(2)} {currency}</b><span>نسبة الرسوم</span><b className="text-end">{pct}%</b><span>الرسوم المطلوبة</span><b className="text-end text-primary">${feeAmount.toFixed(2)}</b></div>
          {cfg.withdraw_fee_image && <img src={cfg.withdraw_fee_image} alt="محفظة الرسوم" className="mx-auto max-h-56 rounded-xl bg-card object-contain" />}
          {cfg.withdraw_fee_wallet && <div><p className="mb-1 text-xs text-muted-foreground">محفظة استلام الرسوم</p><div className="flex items-center gap-2 rounded-xl bg-input p-2"><span dir="ltr" className="min-w-0 flex-1 break-all text-xs">{cfg.withdraw_fee_wallet}</span><Button size="icon" variant="ghost" aria-label="نسخ محفظة الرسوم" onClick={() => copy(cfg.withdraw_fee_wallet)}><Copy /></Button></div></div>}
          {cfg.withdraw_fee_notice && <p className="whitespace-pre-wrap text-muted-foreground">{cfg.withdraw_fee_notice}</p>}
          <input aria-label="رقم معاملة الرسوم" dir="ltr" className={field} placeholder="رقم معاملة دفع الرسوم (TxID)" value={feeTx} onChange={e => setFeeTx(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={loading} onClick={() => sendWithdraw("")}>تخطي</Button>
            <Button disabled={loading || feeTx.trim().length < 6} onClick={() => sendWithdraw(feeTx)}>{loading ? "جارٍ…" : "إرسال الرسوم"}</Button>
          </div>
          <button className="w-full text-xs text-muted-foreground" onClick={() => setFeeStep(false)}>إلغاء</button>
        </div>
      </div>}
    </div>
  );
}


export function LocalTab() {
  const [contacts, setContacts] = useState<any[]>([]);
  useEffect(() => { supabase.from("agent_contacts").select("*").eq("is_active", true).then(({data})=>setContacts(data ?? [])); }, []);
  return (
    <div className="space-y-3">
      <div className="glass rounded-3xl p-6">
        <h2 className="text-xl font-extrabold">الإيداع المحلي عبر الوكلاء</h2>
        <p className="text-xs text-muted-foreground mt-1">تواصل مع أحد الوكلاء أدناه لإيداع نقاط محلياً.</p>
      </div>
      {contacts.length === 0 && <div className="glass rounded-2xl p-6 text-center text-muted-foreground">لا يوجد وكلاء مضافون حالياً</div>}
      {contacts.map(c => (
        <a key={c.id} href={c.link} target="_blank" rel="noreferrer" className="glass rounded-2xl p-4 flex items-center justify-between hover:bg-secondary/50 transition block">
          <div>
            <div className="font-bold">{c.name}</div>
            {c.note && <div className="text-xs text-muted-foreground mt-0.5">{c.note}</div>}
          </div>
          <span className="btn-primary px-4 py-2 rounded-xl text-sm font-bold">تواصل</span>
        </a>
      ))}
    </div>
  );
}

export function ShopTab({ profile, packages, reload }: any) {
  const [products, setProducts] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const requestPackagePurchaseFn = useServerFn(requestPackagePurchase);
  useEffect(()=>{ supabase.from("products").select("*").eq("is_available",true).then(({data})=>setProducts(data ?? [])); },[]);

  const buy = async (p:any) => {
    if (Number(profile.balance) < Number(p.price)) { toast.error("نقاط غير كافية"); return; }
    setBusy(p.id);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("product_orders").insert({ user_id: u.user!.id, product_id: p.id, price: p.price });
    if (error) { setBusy(null); toast.error(error.message); return; }
    const { error: e2 } = await supabase.from("profiles").update({ balance: Number(profile.balance) - Number(p.price) }).eq("id", u.user!.id);
    setBusy(null);
    if (e2) { toast.error(e2.message); return; }
    toast.success("تم إرسال طلب الشراء"); reload();
  };

  const buyPackage = async (pkg: any) => {
    if (Number(profile.balance) < Number(pkg.price)) { toast.error("رصيد غير كافٍ لشراء الباقة"); return; }
    if (profile.package_id) { toast.error("لديك باقة مفعّلة بالفعل"); return; }
    setBusy("pkg-"+pkg.id);
    const result = await requestPackagePurchaseFn({ data: { packageId: Number(pkg.id) } });
    setBusy(null);
    if (!result.ok) { toast.error(result.error); return; }
    toast.success("تم إرسال طلب شراء الباقة. بانتظار موافقة الأدمن للتفعيل."); reload();
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-3xl p-6 flex justify-between items-center">
        <div>
          <div className="text-xs text-muted-foreground">رصيدك</div>
          <div className="text-2xl font-black text-gradient">${Number(profile?.balance??0).toFixed(2)}</div>
        </div>
        <Package className="w-8 h-8 text-primary" />
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="font-bold mb-1">باقات التداول (عقود إلكترونية)</h3>
        <p className="text-xs text-muted-foreground mb-3">اشترِ الباقة برصيدك لتفعيل تداولها اليومي.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(packages ?? []).filter((p: any) => p.is_visible !== false || profile?.package_id === p.id).map((pkg: any) => {
            const owned = profile?.package_id === pkg.id;
            const highestRate = Math.max(...(packages ?? []).filter((p: any) => p.is_visible !== false).map((item: any) => Number(item.daily_rate ?? 0)));
            const anyBadge = (packages ?? []).some((p: any) => p.badge);
            const label = pkg.badge || (!anyBadge && Number(pkg.daily_rate) === highestRate ? "الأكثر ربحاً" : "");
            const best = !!label;
            return (
              <div key={pkg.id} className={`relative bg-secondary/50 rounded-2xl p-4 ${best ? "ring-2 ring-primary" : ""}`}>
                {best && <span className="absolute -top-2 left-3 btn-primary rounded-full px-2 py-0.5 text-[10px] font-black">{label}</span>}
                <div className="text-xs text-muted-foreground">{pkg.name}</div>
                {pkg.package_type && <div className="text-[11px] text-muted-foreground mt-1">{pkg.package_type}</div>}
                <div className="text-2xl font-black mt-1">${pkg.price}</div>
                <div className="mt-1 text-xs font-bold text-success">ربح يومي ${Number(pkg.daily_rate).toFixed(1)}+ أو أكثر</div>
                <button disabled={busy===("pkg-"+pkg.id) || owned || !!profile?.package_id || Number(profile?.balance ?? 0) < Number(pkg.price)}
                  onClick={()=>buyPackage(pkg)}
                  className="btn-primary w-full mt-3 rounded-lg py-1.5 text-xs font-bold disabled:opacity-50">
                  {owned ? "مفعّلة" : "شراء"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="font-bold mb-3">المنتجات</h3>
        {products.length === 0 ? <div className="text-sm text-muted-foreground text-center py-4">لا توجد منتجات حالياً</div> :
          <div className="grid grid-cols-2 gap-3">
            {products.map(p => (
              <div key={p.id} className="bg-secondary/40 rounded-2xl p-3">
                {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-32 object-cover rounded-xl" />}
                <div className="font-bold mt-2 text-sm">{p.name}</div>
                {p.description && <div className="text-xs text-muted-foreground line-clamp-2">{p.description}</div>}
                <div className="flex justify-between items-center mt-3">
                  <span className="text-gradient font-black">${p.price}</span>
                  <button disabled={busy===p.id || Number(profile?.balance ?? 0) < Number(p.price)} onClick={()=>buy(p)}
                    className="btn-primary px-3 py-1.5 rounded-lg text-xs font-bold">شراء</button>
                </div>
              </div>
            ))}
          </div>}
      </div>
    </div>
  );
}


export function ReferralTab({ profile, refs }: any) {
  const code = profile?.referral_code ?? "";
  return (
    <div className="space-y-4">
      <div className="glass rounded-3xl p-6 text-center">
        <Share2 className="w-10 h-10 text-primary mx-auto" />
        <div className="mt-3 text-3xl font-black">{refs.length}</div>
        <div className="text-xs text-muted-foreground">إجمالي الإحالات</div>
      </div>
      <div className="glass rounded-3xl p-5 text-center">
        <div className="text-xs text-muted-foreground mb-2">رمز الإحالة الخاص بك</div>
        <div className="text-5xl font-black tracking-[0.4em] text-gradient py-3">{code}</div>
        <button onClick={()=>{navigator.clipboard.writeText(code); toast.success("تم نسخ الرمز");}} className="btn-primary mt-3 w-full rounded-xl py-2.5 text-sm font-bold">
          نسخ الرمز
        </button>
        <p className="text-xs text-muted-foreground mt-3">شارك هذا الرمز مع أصدقائك ليدخلوه عند التسجيل.</p>
      </div>
      <div className="glass rounded-3xl p-5">
        <h3 className="font-bold mb-2">قائمة الإحالات</h3>
        {refs.length === 0 ? <div className="text-sm text-muted-foreground">لا توجد إحالات بعد</div> :
          <ul className="divide-y divide-border text-sm">
            {refs.map((r:any)=>(
              <li key={r.id} className="py-2">
                <div className="font-medium">{r.full_name ?? r.email}</div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar")} • {r.is_active ? "مفعّل" : "غير مفعّل"}</div>
              </li>
            ))}
          </ul>}
      </div>
    </div>
  );
}

