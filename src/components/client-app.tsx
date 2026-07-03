import { useEffect, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Home, ArrowDownToLine, ArrowUpFromLine, MapPin, ShoppingBag, Share2, LogOut, Crown, Shield, Eye, EyeOff, Copy, Wallet, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@/lib/auth";
import { requestPackagePurchase, transferPoints } from "@/lib/trading.functions";
import { LanguageSwitch } from "@/components/language-switch";
import { HelpButton } from "@/components/help-button";

type Tab = "home" | "deposit" | "withdraw" | "local" | "shop" | "referral";

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "الرئيسية", icon: Home },
  { id: "deposit", label: "إيداع", icon: ArrowDownToLine },
  { id: "withdraw", label: "السحب", icon: ArrowUpFromLine },
  { id: "local", label: "إيداع محلي", icon: MapPin },
  { id: "shop", label: "السلة", icon: ShoppingBag },
  { id: "referral", label: "إحالة", icon: Share2 },
];

export function ClientShell({ children, userEmail, roles }: { children: (tab: Tab) => React.ReactNode; userEmail: string; roles: Role[] }) {
  const [tab, setTab] = useState<Tab>("home");
  const nav = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    nav({ to: "/" });
  };

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 px-4 py-3 glass border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg btn-primary grid place-items-center font-black text-sm">P</div>
          <span className="font-extrabold">polone</span>
        </div>
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
          <button onClick={logout} title="خروج" className="glass p-2 rounded-lg"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">{children(tab)}</main>

      <nav className="fixed bottom-3 left-3 right-3 max-w-2xl mx-auto glass rounded-2xl p-2 flex justify-around z-30">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition ${active ? "btn-primary" : "text-muted-foreground"}`}>
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-bold">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function useProfile() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [p, pkg, txs, refs] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.user.id).single(),
      supabase.from("packages").select("*").order("id"),
      supabase.from("daily_yields").select("*").eq("user_id", u.user.id).order("applied_on",{ascending:false}).limit(10),
      supabase.from("profiles").select("id,email,full_name,created_at,is_active").eq("referred_by", u.user.id).order("created_at", { ascending: false }),
    ]);
    setData({ profile: p.data, packages: pkg.data ?? [], yields: txs.data ?? [], refs: refs.data ?? [], user: u.user });
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);
  return { ...data, loading, reload };
}

// ───────── tabs ─────────
export function HomeTab({ profile, packages, refs, yields }: any) {
  const pkg = packages.find((p: any) => p.id === profile?.package_id);
  const [showBal, setShowBal] = useState(false);
  const code = profile?.referral_code ?? "—";
  const copyCode = () => { if (profile?.referral_code) { navigator.clipboard.writeText(code); toast.success("تم نسخ رمز الإحالة"); } };

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



      <div className="glass rounded-3xl p-5">
        <h3 className="font-bold mb-3">سجل الأرباح اليومية</h3>
        {yields.length === 0 ? <div className="text-sm text-muted-foreground">لم تبدأ الأرباح بعد. سيبدأ التداول بعد تفعيل باقتك.</div> :
          <ul className="text-sm divide-y divide-border">
            {yields.map((y: any) => (
              <li key={y.id} className="flex justify-between py-2">
                <span>{y.applied_on}</span>
                <span className="text-success font-bold">{showBal ? `+$${Number(y.amount).toFixed(2)}` : "+$***"}</span>
              </li>
            ))}
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
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("deposit_requests").insert({ user_id: u.user!.id, amount: a, tx_hash: tx, package_id: null as any });
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

      </div>

      <div className="glass rounded-3xl p-6 space-y-3">
        <h3 className="font-bold">تفاصيل طلب الإيداع</h3>
        <input type="number" step="0.01" min={1} className="w-full bg-input border border-border rounded-xl px-4 py-3"
          placeholder="المبلغ بالـ USDT" value={amount} onChange={e => setAmount(e.target.value)} />
        <input className="w-full bg-input border border-border rounded-xl px-4 py-3"
          placeholder="رقم عملية التحويل / TX Hash (اختياري)" value={tx} onChange={e => setTx(e.target.value)} />
        <button disabled={loading} onClick={submit} className="btn-primary w-full rounded-xl py-3 font-bold">
          {loading ? "..." : "إرسال طلب الإيداع"}
        </button>
        <p className="text-[11px] text-muted-foreground">لشراء باقة تداول: ادفع رصيدك من تبويب «السلة».</p>
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


export function WithdrawTab({ profile, reload }: any) {
  const [mode, setMode] = useState<"withdraw" | "transfer">("withdraw");
  const [wallet, setWallet] = useState("");
  const [toCode, setToCode] = useState("");
  const [amt, setAmt] = useState("");
  const [withdrawDesc, setWithdrawDesc] = useState("");
  const [showWithdrawDesc, setShowWithdrawDesc] = useState(false);
  const [loading, setLoading] = useState(false);
  const transferPointsFn = useServerFn(transferPoints);
  const active = !!profile?.is_active;

  useEffect(() => {
    supabase.from("settings").select("value").eq("key", "withdraw_description").maybeSingle()
      .then(({ data }) => setWithdrawDesc(data?.value ?? ""));
  }, []);

  const submitWithdraw = async () => {
    if (!active) { toast.error("حسابك غير مفعّل — لا يمكن السحب"); return; }
    const a = Number(amt);
    if (!a || a < 49) { toast.error("الحد الأدنى للسحب 49$"); return; }
    if (!wallet.trim()) { toast.error("أدخل عنوان المحفظة"); return; }
    if (a > Number(profile?.balance ?? 0)) { toast.error("رصيد غير كافٍ"); return; }
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("withdrawals").insert({ user_id: u.user!.id, wallet_address: wallet, amount: a });
    if (error) { setLoading(false); toast.error(error.message); return; }
    await supabase.from("profiles").update({ balance: Number(profile.balance) - a }).eq("id", u.user!.id);
    setLoading(false);
    toast.success("تم إرسال طلب السحب وخصم النقاط");
    setWallet(""); setAmt(""); reload();
  };

  const submitTransfer = async () => {
    if (!active) { toast.error("حسابك غير مفعّل — لا يمكن التحويل"); return; }
    const a = Number(amt);
    if (!a || a <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    if (a > Number(profile?.balance ?? 0)) { toast.error("رصيد غير كافٍ"); return; }
    if (!/^\d{5}$/.test(toCode.trim())) { toast.error("أدخل رمز إحالة من 5 أرقام"); return; }
    setLoading(true);
    const result = await transferPointsFn({ data: { toCode: toCode.trim(), amount: a } });
    setLoading(false);
    if (!result.ok) { toast.error(result.error); return; }
    toast.success("تم التحويل");
    setAmt(""); setToCode(""); reload();
  };

  return (
    <div className="space-y-4">
      {!active && (
        <div className="glass rounded-2xl p-4 border border-destructive/40 text-sm text-destructive">
          حسابك غير مفعّل. لا يمكنك السحب أو التحويل قبل تفعيل باقة من «السلة».
        </div>
      )}
      <div className="glass rounded-2xl p-2 flex">
        <button onClick={()=>setMode("withdraw")} className={`flex-1 py-2.5 rounded-xl font-bold text-sm ${mode==="withdraw"?"btn-primary":"text-muted-foreground"}`}>سحب</button>
        <button onClick={()=>setMode("transfer")} className={`flex-1 py-2.5 rounded-xl font-bold text-sm ${mode==="transfer"?"btn-primary":"text-muted-foreground"}`}>تحويل</button>
      </div>

      <div className="glass rounded-3xl p-6">
        <div className="text-xs text-muted-foreground">رصيدك الحالي</div>
        <div className="text-3xl font-black text-gradient">${Number(profile?.balance ?? 0).toFixed(2)}</div>
        <div className="mt-4 space-y-3">
          {mode === "withdraw" ? (
            <>
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="font-bold">تنبيه: السحب متاح فقط على محفظة Tron / TRC20.</span>
              </div>
              {withdrawDesc && (
                <div className="space-y-2">
                  <button type="button" onClick={() => setShowWithdrawDesc(v => !v)} className="glass px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2">
                    <Info className="w-4 h-4 text-primary" /> وصف عملية السحب
                  </button>
                  {showWithdrawDesc && <div className="rounded-xl bg-secondary/40 px-4 py-3 text-xs leading-6 text-muted-foreground whitespace-pre-line">{withdrawDesc}</div>}
                </div>
              )}
              <input className="w-full bg-input border border-border rounded-xl px-4 py-3" placeholder="عنوان محفظة Tron / TRC20"
                value={wallet} onChange={e=>setWallet(e.target.value)} />
            </>
          ) : (
            <input inputMode="numeric" maxLength={5} className="w-full bg-input border border-border rounded-xl px-4 py-3 text-center tracking-widest text-lg font-bold"
              placeholder="رمز المستلم (5 أرقام)" value={toCode} onChange={e=>setToCode(e.target.value.replace(/\D/g,""))} />
          )}
          <input type="number" step="0.01" min={mode==="withdraw"?49:0.01} className="w-full bg-input border border-border rounded-xl px-4 py-3"
            placeholder={mode==="withdraw" ? "المبلغ (الحد الأدنى 49$)" : "المبلغ"} value={amt} onChange={e=>setAmt(e.target.value)} />
          <button disabled={loading || !active} onClick={mode==="withdraw"?submitWithdraw:submitTransfer}
            className="btn-primary w-full rounded-xl py-3 font-bold">{loading?"...":mode==="withdraw"?"طلب السحب":"تحويل النقاط"}</button>
          <p className="text-xs text-muted-foreground">الحد الأدنى للسحب 49$ ولا يوجد حد أعلى. السحب فقط على Tron، والتحويل متاح فقط بين الحسابات المفعّلة.</p>
        </div>
      </div>
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
        <ShoppingBag className="w-8 h-8 text-primary" />
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="font-bold mb-1">باقات التداول (عقود إلكترونية)</h3>
        <p className="text-xs text-muted-foreground mb-3">اشترِ الباقة برصيدك لتفعيل تداولها اليومي.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {packages?.map((pkg: any) => {
            const owned = profile?.package_id === pkg.id;
            const best = Number(pkg.id) === 4 || String(pkg.name ?? "").includes("الأكثر");
            return (
              <div key={pkg.id} className={`relative bg-secondary/50 rounded-2xl p-4 ${best ? "ring-2 ring-primary" : ""}`}>
                {best && <span className="absolute -top-2 left-3 btn-primary rounded-full px-2 py-0.5 text-[10px] font-black">الأكثر ربحاً</span>}
                <div className="text-xs text-muted-foreground">{pkg.name}</div>
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

