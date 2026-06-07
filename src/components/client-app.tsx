import { useEffect, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, ArrowDownToLine, ArrowUpFromLine, MapPin, ShoppingBag, Share2, LogOut, Crown, Shield } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@/lib/auth";

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
      <header className="sticky top-0 z-20 px-4 py-3 glass border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg btn-primary grid place-items-center font-black text-sm">P</div>
          <span className="font-extrabold">polone</span>
        </div>
        <div className="flex items-center gap-2">
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
      supabase.from("packages").select("*"),
      supabase.from("daily_yields").select("*").eq("user_id", u.user.id).order("applied_on",{ascending:false}).limit(10),
      supabase.from("profiles").select("id,email,full_name,created_at").eq("referred_by", u.user.id),
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

  return (
    <div className="space-y-4">
      <div className="glass rounded-3xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-muted-foreground">المحفظة الرقمية</div>
            <div className="text-4xl font-black text-gradient mt-1">${Number(profile?.balance ?? 0).toFixed(2)}</div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${profile?.is_active ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
            {profile?.is_active ? "مفعّل" : "غير مفعّل"}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="bg-secondary/50 rounded-xl p-3">
            <div className="text-muted-foreground text-xs">الباقة</div>
            <div className="font-bold mt-0.5">{pkg ? `${pkg.name} • $${pkg.price}` : "—"}</div>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <div className="text-muted-foreground text-xs">رمز الإحالة</div>
            <div className="font-black mt-0.5 text-primary tracking-widest text-lg">{profile?.referral_code ?? "—"}</div>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <div className="text-muted-foreground text-xs">الاسم</div>
            <div className="font-bold mt-0.5 truncate">{profile?.full_name ?? "—"}</div>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <div className="text-muted-foreground text-xs">عدد الإحالات</div>
            <div className="font-bold mt-0.5">{refs.length}</div>
          </div>
        </div>
        <div className="mt-4 bg-secondary/50 rounded-xl p-3 text-center">
          <div className="text-muted-foreground text-xs">معرّف الحساب</div>
          <div className="font-black text-2xl mt-1 tracking-[0.4em] text-primary select-all">{profile?.referral_code ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground mt-1">المعرّف ورمز الإحالة موحّدان</div>
        </div>
      </div>

      <div className="glass rounded-3xl p-5">
        <h3 className="font-bold mb-3">سجل الأرباح اليومية</h3>
        {yields.length === 0 ? <div className="text-sm text-muted-foreground">لم تبدأ الأرباح بعد. سيبدأ التداول بعد تفعيل باقتك.</div> :
          <ul className="text-sm divide-y divide-border">
            {yields.map((y: any) => (
              <li key={y.id} className="flex justify-between py-2">
                <span>{y.applied_on}</span>
                <span className="text-success font-bold">+${Number(y.amount).toFixed(2)}</span>
              </li>
            ))}
          </ul>}
      </div>
    </div>
  );
}


export function DepositTab({ packages, reload }: any) {
  const [pkgId, setPkgId] = useState<number | null>(null);
  const [tx, setTx] = useState("");
  const [wallet, setWallet] = useState<{ address: string; network: string }>({ address: "", network: "" });
  const [loading, setLoading] = useState(false);
  const [mine, setMine] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("settings").select("*").in("key",["deposit_wallet","deposit_network"]).then(({ data }) => {
      const map: any = {}; data?.forEach(r => map[r.key] = r.value);
      setWallet({ address: map.deposit_wallet ?? "", network: map.deposit_network ?? "" });
    });
    supabase.auth.getUser().then(({ data: u }) => {
      if (u.user) supabase.from("deposit_requests").select("*,packages(name,price)").eq("user_id", u.user.id).order("created_at",{ascending:false}).then(({data})=>setMine(data ?? []));
    });
  }, []);

  const submit = async () => {
    if (!pkgId) { toast.error("اختر باقة"); return; }
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("deposit_requests").insert({ user_id: u.user!.id, package_id: pkgId, tx_hash: tx });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إرسال طلب الإيداع. بانتظار موافقة الأدمن.");
    setTx(""); setPkgId(null); reload();
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-3xl p-6">
        <h2 className="text-xl font-extrabold">إيداع وشراء باقة</h2>
        <p className="text-xs text-muted-foreground mt-1">حوّل قيمة الباقة إلى المحفظة أدناه ثم أرسل طلب الإيداع.</p>
        <div className="mt-4 bg-secondary/50 rounded-xl p-4">
          <div className="text-xs text-muted-foreground">الشبكة: {wallet.network || "—"}</div>
          <div className="font-mono text-sm mt-2 break-all select-all bg-background/40 p-3 rounded-lg">{wallet.address || "لم يحدد بعد"}</div>
          <button onClick={() => { navigator.clipboard.writeText(wallet.address); toast.success("تم النسخ"); }}
            className="mt-2 text-xs text-primary">نسخ العنوان</button>
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <h3 className="font-bold mb-3">اختر باقتك</h3>
        <div className="grid grid-cols-2 gap-3">
          {packages.map((p: any) => (
            <button key={p.id} onClick={() => setPkgId(p.id)}
              className={`p-4 rounded-2xl text-right transition ${pkgId === p.id ? "btn-primary" : "bg-secondary/50 hover:bg-secondary"}`}>
              <div className="text-xs opacity-70">{p.name}</div>
              <div className="text-2xl font-black mt-1">${p.price}</div>
            </button>
          ))}
        </div>
        <input className="mt-4 w-full bg-input border border-border rounded-xl px-4 py-3"
          placeholder="رقم عملية التحويل / TX Hash (اختياري)" value={tx} onChange={e => setTx(e.target.value)} />
        <button disabled={loading || !pkgId} onClick={submit} className="btn-primary w-full mt-3 rounded-xl py-3 font-bold">
          {loading ? "..." : "إرسال طلب الإيداع"}
        </button>
      </div>


      {mine.length > 0 && (
        <div className="glass rounded-3xl p-5">
          <h3 className="font-bold mb-2">طلباتي</h3>
          <ul className="divide-y divide-border text-sm">
            {mine.map((r:any)=>(
              <li key={r.id} className="py-2 flex justify-between">
                <span>{r.packages?.name} • ${r.packages?.price}</span>
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
  const [loading, setLoading] = useState(false);

  const submitWithdraw = async () => {
    const a = Number(amt);
    if (!a || a <= 0 || a > 40) { toast.error("الحد الأقصى للسحب 40$"); return; }
    if (!wallet.trim()) { toast.error("أدخل عنوان المحفظة"); return; }
    if (a > Number(profile?.balance ?? 0)) { toast.error("رصيد غير كافٍ"); return; }
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("withdrawals").insert({ user_id: u.user!.id, wallet_address: wallet, amount: a });
    if (error) { setLoading(false); toast.error(error.message); return; }
    // Deduct immediately
    await supabase.from("profiles").update({ balance: Number(profile.balance) - a }).eq("id", u.user!.id);
    setLoading(false);
    toast.success("تم إرسال طلب السحب وخصم النقاط");
    setWallet(""); setAmt(""); reload();
  };

  const submitTransfer = async () => {
    const a = Number(amt);
    if (!a || a <= 0 || a > 40) { toast.error("الحد الأقصى للتحويل 40$"); return; }
    if (a > Number(profile?.balance ?? 0)) { toast.error("رصيد غير كافٍ"); return; }
    if (!/^\d{5}$/.test(toCode.trim())) { toast.error("أدخل رمز إحالة من 5 أرقام"); return; }
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const { data: rec, error: e0 } = await (supabase.from("profiles") as any)
      .select("id,balance").eq("referral_code", toCode.trim()).maybeSingle();
    if (e0 || !rec) { setLoading(false); toast.error("المستلم غير موجود"); return; }
    if (rec.id === u.user!.id) { setLoading(false); toast.error("لا يمكن التحويل لنفسك"); return; }
    const { error: e1 } = await supabase.from("profiles").update({ balance: Number(profile.balance) - a }).eq("id", u.user!.id);
    if (e1) { setLoading(false); toast.error(e1.message); return; }
    const { error: e2 } = await supabase.from("profiles").update({ balance: Number(rec.balance) + a }).eq("id", rec.id);
    const { error: e3 } = await supabase.from("transfers").insert({ from_user: u.user!.id, to_user: rec.id, amount: a });
    setLoading(false);
    if (e2 || e3) { toast.error("حدث خطأ"); return; }
    toast.success("تم التحويل");
    setAmt(""); setToCode(""); reload();
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-2 flex">
        <button onClick={()=>setMode("withdraw")} className={`flex-1 py-2.5 rounded-xl font-bold text-sm ${mode==="withdraw"?"btn-primary":"text-muted-foreground"}`}>سحب</button>
        <button onClick={()=>setMode("transfer")} className={`flex-1 py-2.5 rounded-xl font-bold text-sm ${mode==="transfer"?"btn-primary":"text-muted-foreground"}`}>تحويل</button>
      </div>

      <div className="glass rounded-3xl p-6">
        <div className="text-xs text-muted-foreground">رصيدك الحالي</div>
        <div className="text-3xl font-black text-gradient">${Number(profile?.balance ?? 0).toFixed(2)}</div>
        <div className="mt-4 space-y-3">
          {mode === "withdraw" ? (
            <input className="w-full bg-input border border-border rounded-xl px-4 py-3" placeholder="عنوان محفظتك"
              value={wallet} onChange={e=>setWallet(e.target.value)} />
          ) : (
            <input inputMode="numeric" maxLength={5} className="w-full bg-input border border-border rounded-xl px-4 py-3 text-center tracking-widest text-lg font-bold"
              placeholder="رمز المستلم (5 أرقام)" value={toCode} onChange={e=>setToCode(e.target.value.replace(/\D/g,""))} />
          )}
          <input type="number" step="0.01" max={40} className="w-full bg-input border border-border rounded-xl px-4 py-3"
            placeholder="المبلغ (حد أقصى 40$)" value={amt} onChange={e=>setAmt(e.target.value)} />
          <button disabled={loading} onClick={mode==="withdraw"?submitWithdraw:submitTransfer}
            className="btn-primary w-full rounded-xl py-3 font-bold">{loading?"...":mode==="withdraw"?"طلب السحب":"تحويل النقاط"}</button>
          <p className="text-xs text-muted-foreground">تُخصم النقاط تلقائياً عند إرسال العملية. في حال رفض السحب تُعاد إلى رصيدك.</p>
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

export function ShopTab({ profile, reload }: any) {
  const [products, setProducts] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
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
  return (
    <div className="space-y-3">
      <div className="glass rounded-3xl p-6 flex justify-between items-center">
        <div>
          <div className="text-xs text-muted-foreground">رصيدك</div>
          <div className="text-2xl font-black text-gradient">${Number(profile?.balance??0).toFixed(2)}</div>
        </div>
        <ShoppingBag className="w-8 h-8 text-primary" />
      </div>
      {products.length === 0 && <div className="glass rounded-2xl p-6 text-center text-muted-foreground">لا توجد منتجات حالياً</div>}
      <div className="grid grid-cols-2 gap-3">
        {products.map(p => (
          <div key={p.id} className="glass rounded-2xl p-3">
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
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar")}</div>
              </li>
            ))}
          </ul>}
      </div>
    </div>
  );
}

