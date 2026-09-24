import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ChevronUp, ChevronDown } from "lucide-react";
import { runDailyYields } from "@/lib/admin.functions";
import { promoteAgent, revokeAgent, updateAgentBalance } from "@/lib/agent-admin.functions";
import { BrandLogo } from "@/components/brand-logo";


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "لوحة الإدارة — Polone" },
    { name: "description", content: "إدارة حسابات وعمليات وإعدادات منصة Polone." },
    { property: "og:title", content: "لوحة الإدارة — Polone" },
    { property: "og:description", content: "إدارة حسابات وعمليات وإعدادات منصة Polone." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Admin,
});

type Tab = "deposits" | "withdrawals" | "orders" | "users" | "packages" | "products" | "agents" | "contacts" | "settings" | "help" | "advertisements" | "notifications";
const TABS: { id: Tab; label: string }[] = [
  { id: "deposits", label: "طلبات الإيداع" },
  { id: "withdrawals", label: "طلبات السحب" },
  { id: "orders", label: "طلبات المنتجات" },
  { id: "users", label: "المستخدمون" },
  { id: "packages", label: "الباقات" },
  { id: "products", label: "المنتجات" },
  { id: "contacts", label: "وكلاء الإيداع" },
  { id: "agents", label: "التجار" },
  { id: "help", label: "أقسام المساعدة" },
  { id: "advertisements", label: "الإعلانات" },
  { id: "notifications", label: "الإشعارات" },
  { id: "settings", label: "الإعدادات" },
];

function Admin() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("deposits");
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role","admin").maybeSingle();
      if (!r) { toast.error("غير مصرح"); nav({ to: "/dashboard" }); return; }
      setAllowed(true);
    });
  }, [nav]);

  if (!allowed) return <div className="min-h-screen grid place-items-center">...</div>;

  return (
    <div className="internal-app min-h-screen">
      <header className="px-4 py-3 glass border-b flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-1 text-sm"><ArrowLeft className="w-4 h-4" /> العودة</Link>
        <div className="flex items-center gap-3">
          <BrandLogo className="h-8 w-8" />
          <h1 className="font-extrabold">لوحة الأدمن</h1>
        </div>
        <div />
      </header>
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab===t.id ? "btn-primary" : "glass"}`}>{t.label}</button>
          ))}
        </div>
        {tab === "deposits" && <Deposits />}
        {tab === "withdrawals" && <Withdrawals />}
        {tab === "orders" && <Orders />}
        {tab === "users" && <Users />}
        {tab === "packages" && <Packages />}
        {tab === "products" && <Products />}
        {tab === "contacts" && <Contacts />}
        {tab === "agents" && <Agents />}
        {tab === "help" && <HelpAdmin />}
        {tab === "advertisements" && <AdvertisementsAdmin />}
        {tab === "notifications" && <NotificationsAdmin />}
        
        {tab === "settings" && <Settings />}
      </div>
    </div>
  );
}

function Deposits() {
  const [items, setItems] = useState<any[]>([]);
  const load = () => supabase.from("deposit_requests")
    .select("*,profiles!deposit_requests_user_profile_fkey(email,full_name,balance,referral_code),packages(name,price,daily_rate)")
    .order("created_at",{ascending:false}).then(({data})=>setItems(data ?? []));
  useEffect(()=>{ load(); },[]);
  const decide = async (r: any, status: "approved" | "rejected") => {
    if (status === "approved") {
      if (r.package_id) {
        // Package purchase from shop (balance already deducted) → just activate the package
        const { error } = await supabase.from("profiles").update({
          is_active: true, package_id: r.package_id, activated_at: new Date().toISOString()
        }).eq("id", r.user_id);
        if (error) return toast.error(error.message);
      } else {
        // Regular cash deposit → add amount to balance
        const cur = Number(r.profiles?.balance ?? 0);
        const { error } = await supabase.from("profiles").update({ balance: cur + Number(r.amount) }).eq("id", r.user_id);
        if (error) return toast.error(error.message);
      }
    } else if (status === "rejected" && r.package_id && r.tx_hash === "PKG-BUY") {
      // Refund package purchase
      const cur = Number(r.profiles?.balance ?? 0);
      await supabase.from("profiles").update({ balance: cur + Number(r.amount) }).eq("id", r.user_id);
    }
    await supabase.from("deposit_requests").update({ status, processed_at: new Date().toISOString() }).eq("id", r.id);
    toast.success("تم"); load();
  };
  return (
    <div className="space-y-2">
      {items.length === 0 && <Empty />}
      {items.map(r => (
        <div key={r.id} className="glass rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold">{r.profiles?.full_name ?? r.profiles?.email}</div>
              <div className="text-xs text-muted-foreground">{r.profiles?.email} • ID: <b className="font-mono">{r.profiles?.referral_code}</b></div>
              <div className="text-[11px] text-muted-foreground mt-0.5">🕒 {new Date(r.created_at).toLocaleString("ar-EG", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12: false })}</div>
              {r.package_id
                ? <div className="text-sm mt-1">🎁 شراء باقة: {r.packages?.name} • ${r.packages?.price} • يومياً ${r.packages?.daily_rate}</div>
                : <div className="text-sm mt-1">💰 إيداع رصيد: <b>${Number(r.amount).toFixed(2)}</b></div>}
              {r.tx_hash && <div className="text-xs font-mono mt-1 break-all opacity-70">TX: {r.tx_hash}</div>}
            </div>
            <StatusBadge status={r.status} />
          </div>
          {r.status === "pending" && (
            <div className="flex gap-2 mt-3">
              <button onClick={()=>decide(r,"approved")} className="bg-success/90 text-success-foreground px-3 py-1.5 rounded-lg text-sm font-bold">{r.package_id ? "قبول وتفعيل الباقة" : "قبول وإضافة الرصيد"}</button>
              <button onClick={()=>decide(r,"rejected")} className="bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-lg text-sm font-bold">رفض</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Withdrawals() {
  const [items, setItems] = useState<any[]>([]);
  const load = () => supabase.from("withdrawals")
    .select("*,profiles!withdrawals_user_profile_fkey(email,full_name,balance)")
    .order("created_at",{ascending:false}).then(({data})=>setItems(data ?? []));
  useEffect(()=>{load();},[]);
  const decide = async (r:any, status:"approved"|"rejected") => {
    if (status === "rejected") {
      // Refund: balance was deducted at request time
      const { data: p } = await supabase.from("profiles").select("balance").eq("id", r.user_id).single();
      await supabase.from("profiles").update({ balance: Number(p?.balance ?? 0) + Number(r.amount) }).eq("id", r.user_id);
    }
    await supabase.from("withdrawals").update({ status, processed_at: new Date().toISOString() }).eq("id", r.id);
    toast.success("تم"); load();
  };
  return (
    <div className="space-y-2">
      {items.length === 0 && <Empty />}
      {items.map(r=>(
        <div key={r.id} className="glass rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold">{r.profiles?.full_name ?? r.profiles?.email}</div>
              <div className="text-xs text-muted-foreground">{r.profiles?.email}</div>
              <div className="text-sm mt-1">المبلغ: <b>${r.amount}</b> • رصيد الحساب: ${r.profiles?.balance}</div>
              <div className="text-xs font-mono break-all mt-1">{r.wallet_address}</div>
            </div>
            <StatusBadge status={r.status} />
          </div>
          {r.status === "pending" && (
            <div className="flex gap-2 mt-3">
              <button onClick={()=>decide(r,"approved")} className="bg-success/90 text-success-foreground px-3 py-1.5 rounded-lg text-sm font-bold">قبول</button>
              <button onClick={()=>decide(r,"rejected")} className="bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-lg text-sm font-bold">رفض (إعادة النقاط)</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


function Orders() {
  const [items, setItems] = useState<any[]>([]);
  const load = () => supabase.from("product_orders")
    .select("*,profiles!product_orders_user_profile_fkey(email,full_name),products(name)")
    .order("created_at",{ascending:false}).then(({data})=>setItems(data ?? []));

  useEffect(()=>{load();},[]);
  return (
    <div className="space-y-2">
      {items.length === 0 && <Empty />}
      {items.map(r=>(
        <div key={r.id} className="glass rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold">{r.products?.name}</div>
              <div className="text-xs">{r.profiles?.full_name ?? r.profiles?.email} • ${r.price}</div>
            </div>
            <StatusBadge status={r.status} />
          </div>
          {r.status === "pending" && (
            <div className="flex gap-2 mt-3">
              <button onClick={async()=>{await supabase.from("product_orders").update({status:"approved",processed_at:new Date().toISOString()}).eq("id",r.id);toast.success("تم");load();}} className="bg-success/90 px-3 py-1.5 rounded-lg text-sm font-bold">قبول</button>
              <button onClick={async()=>{await supabase.from("product_orders").update({status:"rejected",processed_at:new Date().toISOString()}).eq("id",r.id);toast.success("تم");load();}} className="bg-destructive/90 px-3 py-1.5 rounded-lg text-sm font-bold">رفض</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Users() {
  const [items, setItems] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [delta, setDelta] = useState<Record<string,string>>({});
  const [pkgSel, setPkgSel] = useState<Record<string,string>>({});
  const [search, setSearch] = useState("");
  const load = () => supabase.from("profiles").select("*,packages(name,price)").order("created_at",{ascending:false}).then(({data})=>setItems(data ?? []));
  useEffect(()=>{
    load();
    supabase.from("packages").select("*").order("id").then(({data})=>setPackages(data ?? []));
  },[]);
  const adjust = async (id:string, sign: 1 | -1) => {
    const a = Number(delta[id]); if (!a || a <= 0) return toast.error("أدخل قيمة موجبة");
    const u = items.find(x=>x.id===id);
    const next = Math.max(0, Number(u.balance) + sign * a);
    await supabase.from("profiles").update({ balance: next }).eq("id", id);
    toast.success(sign === 1 ? "تمت الإضافة" : "تم الخصم");
    setDelta({...delta,[id]:""}); load();
  };
  const toggleActive = async (u:any) => {
    await supabase.from("profiles").update({ is_active: !u.is_active }).eq("id", u.id); load();
  };
  const assignPackage = async (id:string) => {
    const pid = pkgSel[id]; if (!pid) return toast.error("اختر باقة");
    const v = pid === "none" ? null : Number(pid);
    await supabase.from("profiles").update({
      package_id: v, is_active: v !== null, activated_at: v !== null ? new Date().toISOString() : null,
    }).eq("id", id);
    toast.success("تم تحديث الباقة"); load();
  };
  const filtered = items.filter((u:any)=> {
    if (!search) return true;
    const s = search.toLowerCase();
    return (u.email??"").toLowerCase().includes(s) || (u.full_name??"").toLowerCase().includes(s) || (u.referral_code??"").includes(s);
  });
  return (
    <div className="space-y-2">
      <input className="w-full bg-input border border-border rounded px-3 py-2 text-sm" placeholder="بحث: إيميل / اسم / رمز إحالة"
        value={search} onChange={e=>setSearch(e.target.value)} />
      {filtered.map((u:any)=>(
        <div key={u.id} className="glass rounded-xl p-4">
          <div className="flex justify-between">
            <div>
              <div className="font-bold">{u.full_name ?? u.email}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
              <div className="text-xs mt-1">المعرّف/الإحالة: <b className="font-mono tracking-widest">{u.referral_code}</b></div>
              <div className="text-sm mt-1">رصيد: <b>${u.balance}</b> • {u.packages?.name ?? "بدون باقة"} • إحالات: {u.referral_count}</div>
            </div>
            <span className={`text-xs px-2 py-1 rounded h-fit ${u.is_active?"bg-success/20 text-success":"bg-destructive/20 text-destructive"}`}>{u.is_active?"مفعّل":"غير مفعّل"}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 items-center">
            <input className="bg-input border border-border rounded px-2 py-1 text-sm w-28" placeholder="قيمة النقاط" type="number" value={delta[u.id]??""} onChange={e=>setDelta({...delta,[u.id]:e.target.value})} />
            <button onClick={()=>adjust(u.id, 1)} className="bg-success/90 text-success-foreground px-2.5 py-1 rounded text-xs font-bold">+ إضافة</button>
            <button onClick={()=>adjust(u.id, -1)} className="bg-destructive/80 px-2.5 py-1 rounded text-xs font-bold">− خصم</button>
            <button onClick={()=>toggleActive(u)} className="glass px-2.5 py-1 rounded text-xs font-bold">{u.is_active?"حظر":"تفعيل"}</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 items-center">
            <select className="bg-input border border-border rounded px-2 py-1 text-sm" value={pkgSel[u.id] ?? (u.package_id?String(u.package_id):"")} onChange={e=>setPkgSel({...pkgSel,[u.id]:e.target.value})}>
              <option value="">— اختر باقة —</option>
              {packages.map(p=> <option key={p.id} value={p.id}>{p.name} • ${p.price}</option>)}
              <option value="none">إلغاء الباقة</option>
            </select>
            <button onClick={()=>assignPackage(u.id)} className="btn-primary px-2.5 py-1 rounded text-xs font-bold">تفعيل/تغيير الباقة</button>
          </div>
          <ManualReferrals userId={u.id} packages={packages} onChange={load} />
        </div>
      ))}
    </div>
  );
}

const FAKE_NAMES = ["أحمد علي","محمد حسن","سارة كريم","يوسف عبد","نور الدين","علي صادق","حسين جواد","زينب مصطفى","كرار فاضل","مريم سالم","عمر خالد","ليلى ناصر","مصطفى رعد","هدى جبار","باسم وليد","رقية حيدر","سيف الدين","دعاء عادل","أمير قاسم","تقى منير"];

function ManualReferrals({ userId, packages, onChange }: { userId: string; packages: any[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [count, setCount] = useState("1");
  const [names, setNames] = useState("");
  const [active, setActive] = useState(false);
  const [pkgId, setPkgId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => (supabase as any).from("manual_referrals")
    .select("id,full_name,is_active,package_id,created_at").eq("user_id", userId)
    .order("created_at",{ascending:false})
    .then(({ data }: any) => setList(data ?? []));

  useEffect(() => { if (open) load(); }, [open]);

  const add = async () => {
    const n = Math.max(0, Math.min(200, Number(count) || 0));
    const typed = names.split(/[\n,،]+/).map(s=>s.trim()).filter(Boolean);
    const total = typed.length > 0 ? typed.length : n;
    if (total <= 0) return toast.error("أدخل عدد الإحالات أو الأسماء");
    const rows = Array.from({ length: total }, (_, i) => ({
      user_id: userId,
      full_name: typed[i] ?? FAKE_NAMES[Math.floor(Math.random()*FAKE_NAMES.length)] + " " + Math.floor(100+Math.random()*900),
      is_active: active,
      package_id: active && pkgId ? Number(pkgId) : null,
    }));
    setBusy(true);
    const { error } = await (supabase as any).from("manual_referrals").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`تمت إضافة ${total} إحالة`);
    setNames(""); setCount("1");
    load(); onChange();
  };

  const removeOne = async (id: string) => {
    const { error } = await (supabase as any).from("manual_referrals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load(); onChange();
  };

  const removeLast = async () => {
    const n = Math.max(1, Number(count) || 1);
    const ids = list.slice(0, n).map(r=>r.id);
    if (ids.length === 0) return toast.error("لا توجد إحالات وهمية");
    const { error } = await (supabase as any).from("manual_referrals").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`تم نقصان ${ids.length} إحالة`);
    load(); onChange();
  };

  return (
    <div className="mt-3 border-t border-border pt-2">
      <button onClick={()=>setOpen(o=>!o)} className="text-xs font-bold text-primary">
        {open ? "▲ إخفاء زيادة الإحالات" : "▼ زيادة/نقصان الإحالات"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <input type="number" min="1" className="bg-input border border-border rounded px-2 py-1 text-sm w-24" placeholder="العدد" value={count} onChange={e=>setCount(e.target.value)} />
            <label className="flex items-center gap-1 text-xs font-bold">
              <input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} /> مع تفعيل باقة
            </label>
            {active && (
              <select className="bg-input border border-border rounded px-2 py-1 text-sm" value={pkgId} onChange={e=>setPkgId(e.target.value)}>
                <option value="">— بدون باقة —</option>
                {packages.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <textarea className="w-full bg-input border border-border rounded px-2 py-1 text-sm" rows={2}
            placeholder="أسماء وهمية (اختياري) — افصل بينها بفاصلة أو سطر جديد. إذا تركته فارغاً تُولَّد أسماء تلقائياً"
            value={names} onChange={e=>setNames(e.target.value)} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={add} className="bg-success/90 text-success-foreground px-2.5 py-1 rounded text-xs font-bold disabled:opacity-50">+ زيادة الإحالات</button>
            <button onClick={removeLast} className="bg-destructive/80 px-2.5 py-1 rounded text-xs font-bold">− نقصان</button>
          </div>
          {list.length > 0 && (
            <ul className="text-xs divide-y divide-border">
              {list.map(r=>(
                <li key={r.id} className="py-1 flex justify-between items-center">
                  <span>{r.full_name} • {r.is_active ? "مفعّل" : "غير مفعّل"}</span>
                  <button onClick={()=>removeOne(r.id)} className="text-destructive">حذف</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Products() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ name:"", description:"", image_url:"", price:"" });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = async () => {
    const { data, error } = await supabase.from("products")
      .select("id,name,description,price,is_available,image_url,created_at")
      .order("created_at",{ascending:false});
    if (error) return toast.error("تعذر تحميل المنتجات: " + error.message);
    setItems(data ?? []);
  };
  useEffect(()=>{load();},[]);
  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const max = 600;
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
            const c = document.createElement("canvas");
            c.width = w; c.height = h;
            c.getContext("2d")!.drawImage(img, 0, 0, w, h);
            res(c.toDataURL("image/jpeg", 0.6));
          };
          img.onerror = rej;
          img.src = reader.result as string;
        };
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      setForm(f => ({ ...f, image_url: dataUrl }));
    } catch {
      toast.error("تعذر قراءة الصورة");
    } finally {
      setUploading(false);
    }
  };
  const add = async () => {
    if (saving) return;
    if (!form.name || !form.price) return toast.error("اسم وسعر");
    setSaving(true);
    const { error } = await supabase.from("products").insert({
      name: form.name,
      description: form.description || null,
      image_url: form.image_url || null,
      price: Number(form.price),
    });
    setSaving(false);
    if (error) return toast.error("تعذر الإضافة: " + error.message);
    toast.success("تمت إضافة المنتج");
    setForm({name:"",description:"",image_url:"",price:""});
    load();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error("تعذر الحذف: " + error.message);
    toast.success("تم الحذف");
    load();
  };
  const toggle = async (p: any) => {
    const { error } = await supabase.from("products").update({ is_available: !p.is_available }).eq("id", p.id);
    if (error) return toast.error("تعذر التعديل: " + error.message);
    load();
  };
  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-4 grid sm:grid-cols-2 gap-2">
        <input className="bg-input border border-border rounded px-3 py-2" placeholder="اسم المنتج" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
        <input className="bg-input border border-border rounded px-3 py-2" placeholder="السعر بالنقاط" type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} />
        <div className="sm:col-span-2 flex items-center gap-3">
          <label className="btn-primary rounded px-4 py-2 font-bold text-sm cursor-pointer">
            {uploading ? "..." : "اختر صورة من الجهاز"}
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {form.image_url && <img src={form.image_url} alt="معاينة المنتج" className="w-16 h-16 rounded object-cover" />}
          {form.image_url && <button onClick={()=>setForm({...form,image_url:""})} className="text-destructive text-xs">إزالة</button>}
        </div>
        <textarea className="bg-input border border-border rounded px-3 py-2 sm:col-span-2" placeholder="الوصف" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} />
        <button disabled={saving} onClick={add} className="btn-primary rounded px-4 py-2 font-bold sm:col-span-2 disabled:opacity-60">{saving ? "جارٍ الإضافة..." : "إضافة منتج"}</button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">لا توجد منتجات</div>}
        {items.map(p=>(
          <div key={p.id} className="glass rounded-xl p-3 flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {p.image_url && <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded object-cover" />}
              <div className="min-w-0">
                <div className="font-bold truncate">{p.name}</div>
                <div className="text-xs">${p.price} · {p.is_available ? "متاح" : "مخفي"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={()=>toggle(p)} className="text-xs text-primary">{p.is_available ? "إخفاء" : "إظهار"}</button>
              <button onClick={()=>remove(p.id)} className="text-destructive text-sm">حذف</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function Packages() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", package_type: "", price: "", daily_rate: "" });
  const [saving, setSaving] = useState(false);

  const load = () => (supabase as any)
    .from("packages")
    .select("id,name,package_type,price,daily_rate,is_visible")
    .order("price")
    .then(({ data }: { data: any[] | null }) => setItems(data ?? []));

  useEffect(() => { load(); }, []);

  const add = async () => {
    const price = Number(form.price);
    const dailyRate = Number(form.daily_rate);
    if (!form.name.trim() || !form.package_type.trim()) return toast.error("أدخل اسم ونوع الباقة");
    if (!Number.isFinite(price) || price <= 0) return toast.error("أدخل سعراً صحيحاً");
    if (!Number.isFinite(dailyRate) || dailyRate <= 0) return toast.error("أدخل ربحاً يومياً صحيحاً");

    setSaving(true);
    const { error } = await (supabase as any).from("packages").insert({
      name: form.name.trim(),
      package_type: form.package_type.trim(),
      price,
      daily_rate: dailyRate,
    });
    setSaving(false);
    if (error) return toast.error(error.message);

    setForm({ name: "", package_type: "", price: "", daily_rate: "" });
    toast.success("تمت إضافة الباقة");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-4 space-y-3">
        <h2 className="font-bold">إضافة باقة جديدة</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <input className="bg-input border border-border rounded px-3 py-2" placeholder="اسم الباقة" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="bg-input border border-border rounded px-3 py-2" placeholder="نوع الباقة" value={form.package_type} onChange={e => setForm({ ...form, package_type: e.target.value })} />
          <input type="number" min="0.01" step="0.01" className="bg-input border border-border rounded px-3 py-2" placeholder="السعر بالدولار" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          <input type="number" min="0.01" step="0.01" className="bg-input border border-border rounded px-3 py-2" placeholder="الربح اليومي بالدولار" value={form.daily_rate} onChange={e => setForm({ ...form, daily_rate: e.target.value })} />
        </div>
        <button disabled={saving} onClick={add} className="btn-primary w-full rounded px-4 py-2 font-bold disabled:opacity-50">
          {saving ? "جاري الإضافة..." : "إضافة الباقة"}
        </button>
      </div>

      {items.map(pkg => (
        <div key={pkg.id} className="glass rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-bold">{pkg.name} {pkg.is_visible === false && <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">مخفية</span>}</div>
            <div className="text-xs text-muted-foreground mt-1">{pkg.package_type}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-left">
              <div className="font-black">${Number(pkg.price).toFixed(2)}</div>
              <div className="text-xs text-success">${Number(pkg.daily_rate).toFixed(2)} يومياً</div>
            </div>
            <button
              onClick={async () => {
                const { error } = await (supabase as any).from("packages").update({ is_visible: pkg.is_visible === false }).eq("id", pkg.id);
                if (error) return toast.error(error.message);
                load();
              }}
              className="text-xs text-primary font-bold"
            >{pkg.is_visible === false ? "إظهار" : "إخفاء"}</button>
            <button
              onClick={async () => {
                if (!confirm(`حذف الباقة «${pkg.name}» نهائياً؟ إذا كان هناك مشتركون بها سيتم إخفاؤها من الباقات.`)) return;
                const { data, error } = await (supabase as any).rpc("admin_delete_package", { _id: pkg.id });
                if (error) return toast.error("تعذر الحذف: " + error.message);
                toast.success(data === "hidden" ? "الباقة مرتبطة بمشتركين — تم إخفاؤها من قسم الباقات" : "تم حذف الباقة نهائياً");
                load();
              }}
              className="text-destructive text-sm font-bold px-2 py-1 rounded hover:bg-destructive/10"
            >حذف</button>
          </div>
        </div>
      ))}

    </div>
  );
}


function Contacts() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ name:"", link:"", note:"" });
  const load = () => supabase.from("agent_contacts").select("*").order("created_at",{ascending:false}).then(({data})=>setItems(data ?? []));
  useEffect(()=>{load();},[]);
  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-4 grid sm:grid-cols-2 gap-2">
        <input className="bg-input border border-border rounded px-3 py-2" placeholder="اسم الوكيل" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
        <input className="bg-input border border-border rounded px-3 py-2" placeholder="رابط التواصل (واتساب/تيليجرام)" value={form.link} onChange={e=>setForm({...form,link:e.target.value})} />
        <input className="bg-input border border-border rounded px-3 py-2 sm:col-span-2" placeholder="ملاحظة (اختياري)" value={form.note} onChange={e=>setForm({...form,note:e.target.value})} />
        <button onClick={async()=>{if(!form.name||!form.link)return;await supabase.from("agent_contacts").insert(form);setForm({name:"",link:"",note:""});load();}} className="btn-primary rounded px-4 py-2 font-bold sm:col-span-2">إضافة</button>
      </div>
      {items.map(c=>(
        <div key={c.id} className="glass rounded-xl p-3 flex justify-between">
          <div>
            <div className="font-bold">{c.name}</div>
            <div className="text-xs text-muted-foreground">{c.link}</div>
          </div>
          <button onClick={async()=>{await supabase.from("agent_contacts").delete().eq("id",c.id);load();}} className="text-destructive text-sm">حذف</button>
        </div>
      ))}
    </div>
  );
}

function Agents() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [bal, setBal] = useState<Record<string,string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [grants, setGrants] = useState<Record<string, any[]>>({});
  const [saving, setSaving] = useState(false);
  const promoteAgentFn = useServerFn(promoteAgent);
  const updateAgentBalanceFn = useServerFn(updateAgentBalance);
  const revokeAgentFn = useServerFn(revokeAgent);
  const load = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role","agent");
    const ids = roles?.map(r=>r.user_id) ?? [];
    const { data: profs } = ids.length ? await supabase.from("profiles").select("*").in("id", ids) : { data: [] as any[] };
    const { data: bals } = ids.length ? await supabase.from("agent_balances").select("*").in("user_id", ids) : { data: [] as any[] };
    setItems((profs??[]).map(p=>({...p, agent_balance: bals?.find(b=>b.user_id===p.id)?.balance ?? 0 })));
  };
  useEffect(()=>{load();},[]);
  const promote = async () => {
    const q = search.trim();
    if (!q) return;
    setSaving(true);
    try {
      const result = await promoteAgentFn({ data: { account: q } });
      if (!result.ok) return toast.error(result.error);
      toast.success("تم إضافة التاجر");
      setSearch("");
      await load();
    } finally {
      setSaving(false);
    }
  };
  const setBalance = async (id:string, mode: "set" | "add") => {
    const amount = Number(bal[id]);
    if (!Number.isFinite(amount) || amount < 0) return toast.error("قيمة غير صحيحة");
    const result = await updateAgentBalanceFn({ data: { userId: id, amount, mode } });
    if (!result.ok) return toast.error(result.error);
    toast.success("تم التحديث"); setBal({...bal,[id]:""}); load();
  };
  const revoke = async (id:string) => {
    const result = await revokeAgentFn({ data: { userId: id } });
    if (!result.ok) return toast.error(result.error);
    toast.success("تم إلغاء تعيين التاجر"); load();
  };
  const toggle = async (id: string) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    const { data } = await supabase.from("agent_grants")
      .select("*,profiles!agent_grants_to_user_fkey(email,full_name,referral_code)")
      .eq("agent_id", id).order("created_at", { ascending: false }).limit(100);
    setGrants(g => ({ ...g, [id]: data ?? [] }));
  };
  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-4 space-y-2">
        <div className="text-sm font-bold">إضافة تاجر</div>
        <div className="flex gap-2">
          <input className="flex-1 bg-input border border-border rounded px-3 py-2" placeholder="إيميل أو معرّف الحساب (5 أرقام)" value={search} onChange={e=>setSearch(e.target.value)} />
          <button onClick={promote} disabled={saving} className="btn-primary rounded px-4 py-2 font-bold disabled:opacity-60">{saving ? "جاري الإضافة..." : "إضافة"}</button>
        </div>
        <p className="text-[11px] text-muted-foreground">التاجر يمكنه إرسال النقاط للزبائن مباشرة بدون شروط أو تفعيل باقة.</p>
      </div>
      {items.map(u=>(
        <div key={u.id} className="glass rounded-xl p-4">
          <div className="flex justify-between">
            <div>
              <div className="font-bold">{u.full_name ?? u.email}</div>
              <div className="text-xs text-muted-foreground">{u.email} · معرّف: {u.referral_code}</div>
              <div className="text-sm mt-1">رصيد التاجر: <b>${Number(u.agent_balance).toFixed(2)}</b></div>
            </div>
            <button onClick={()=>revoke(u.id)} className="text-destructive text-xs">إلغاء التعيين</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <input className="bg-input border border-border rounded px-2 py-1 text-sm w-32" placeholder="مبلغ" type="number" value={bal[u.id]??""} onChange={e=>setBal({...bal,[u.id]:e.target.value})} />
            <button onClick={()=>setBalance(u.id,"add")} className="btn-primary px-3 py-1 rounded text-xs font-bold">+ إضافة</button>
            <button onClick={()=>setBalance(u.id,"set")} className="glass px-3 py-1 rounded text-xs font-bold">تعيين رصيد</button>
            <button onClick={()=>toggle(u.id)} className="glass px-3 py-1 rounded text-xs font-bold">{open===u.id?"إخفاء السجل":"سجل التحويلات"}</button>
          </div>
          {open===u.id && (
            <div className="mt-3 border-t border-border pt-2">
              {!grants[u.id] ? <div className="text-xs text-muted-foreground">جاري التحميل...</div> :
               grants[u.id].length === 0 ? <div className="text-xs text-muted-foreground">لا توجد عمليات</div> :
                <ul className="text-xs divide-y divide-border">
                  {grants[u.id].map((g:any)=>(
                    <li key={g.id} className="py-2 flex justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate">{g.profiles?.full_name ?? g.profiles?.email ?? g.to_user}</span>
                        <span className="block text-muted-foreground">معرّف: {g.profiles?.referral_code ?? "—"} · {new Date(g.created_at).toLocaleString("ar-IQ",{dateStyle:"short",timeStyle:"medium"})}</span>
                      </span>
                      <span className="text-success font-bold whitespace-nowrap">+${Number(g.amount).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Settings() {
  const [desc, setDesc] = useState("");
  const [withdrawDesc, setWithdrawDesc] = useState("");
  const [supportUrl, setSupportUrl] = useState("");
  const [supportEnabled, setSupportEnabled] = useState(false);
  const [wallets, setWallets] = useState<any[]>([]);
  const [wForm, setWForm] = useState({ label:"", address:"", network:"", currency:"", image_url:"" });
  const [wUploading, setWUploading] = useState(false);
  const [bonusEnabled, setBonusEnabled] = useState(true);
  const [bonusAmount, setBonusAmount] = useState("25");
  const [offerEnabled, setOfferEnabled] = useState(true);
  const [offerTitle, setOfferTitle] = useState("");
  const [offerGoal, setOfferGoal] = useState("10");
  const [offerReward, setOfferReward] = useState("94");
  const [signalEnabled, setSignalEnabled] = useState(false);
  const [signalDirection, setSignalDirection] = useState<"up" | "down">("up");
  const [signalText, setSignalText] = useState("");
  const [tabVisibility, setTabVisibility] = useState({ deposit: true, withdraw: true, local: true, shop: true, referral: true });
  const loadWallets = () => supabase.from("deposit_wallets").select("*").order("sort_order").then(({data})=>setWallets(data ?? []));
  useEffect(()=>{
    supabase.from("settings").select("*").eq("key","deposit_description").maybeSingle().then(({data})=>setDesc(data?.value ?? ""));
    supabase.from("settings").select("*").eq("key","withdraw_description").maybeSingle().then(({data})=>setWithdrawDesc(data?.value ?? ""));
    supabase.from("settings").select("*").eq("key","support_url").maybeSingle().then(({data})=>setSupportUrl(data?.value ?? ""));
    supabase.from("settings").select("*").eq("key","support_enabled").maybeSingle().then(({data})=>setSupportEnabled((data?.value ?? "false") === "true"));
    supabase.from("settings").select("key,value").in("key",["welcome_bonus_enabled","welcome_bonus_amount","referral_offer_enabled","referral_offer_goal","referral_offer_reward","referral_offer_title","market_signal_enabled","market_signal_direction","market_signal_text","tab_deposit_visible","tab_withdraw_visible","tab_local_visible","tab_shop_visible","tab_referral_visible"]).then(({data})=>{
      const m = Object.fromEntries((data ?? []).map((r:any)=>[r.key, r.value]));
      setBonusEnabled((m.welcome_bonus_enabled ?? "true") === "true");
      setBonusAmount(m.welcome_bonus_amount ?? "25");
      setOfferEnabled((m.referral_offer_enabled ?? "true") === "true");
      setOfferGoal(m.referral_offer_goal ?? "10");
      setOfferReward(m.referral_offer_reward ?? "94");
      setOfferTitle(m.referral_offer_title ?? "");
      setSignalEnabled((m.market_signal_enabled ?? "false") === "true");
      setSignalDirection(m.market_signal_direction === "down" ? "down" : "up");
      setSignalText(m.market_signal_text ?? "");
      setTabVisibility({
        deposit: (m.tab_deposit_visible ?? "true") === "true",
        withdraw: (m.tab_withdraw_visible ?? "true") === "true",
        local: (m.tab_local_visible ?? "true") === "true",
        shop: (m.tab_shop_visible ?? "true") === "true",
        referral: (m.tab_referral_visible ?? "true") === "true",
      });
    });
    loadWallets();
  },[]);
  const saveBonus = async () => {
    const a = Number(bonusAmount);
    if (!Number.isFinite(a) || a < 0) return toast.error("قيمة غير صحيحة");
    await supabase.from("settings").upsert([
      { key:"welcome_bonus_enabled", value: bonusEnabled ? "true" : "false", updated_at: new Date().toISOString() },
      { key:"welcome_bonus_amount", value: String(a), updated_at: new Date().toISOString() },
    ]);
    toast.success("تم حفظ إعدادات البونص الترحيبي");
  };
  const saveOffer = async () => {
    const g = Number(offerGoal), r = Number(offerReward);
    if (!Number.isInteger(g) || g <= 0) return toast.error("عدد الإحالات غير صحيح");
    if (!Number.isFinite(r) || r <= 0) return toast.error("قيمة المكافأة غير صحيحة");
    await supabase.from("settings").upsert([
      { key:"referral_offer_enabled", value: offerEnabled ? "true" : "false", updated_at: new Date().toISOString() },
      { key:"referral_offer_goal", value: String(g), updated_at: new Date().toISOString() },
      { key:"referral_offer_reward", value: String(r), updated_at: new Date().toISOString() },
      { key:"referral_offer_title", value: offerTitle.trim(), updated_at: new Date().toISOString() },
    ]);
    toast.success("تم حفظ إعدادات العرض");
  };
  const saveSignal = async () => {
    const { error } = await supabase.from("settings").upsert([
      { key:"market_signal_enabled", value: signalEnabled ? "true" : "false", updated_at: new Date().toISOString() },
      { key:"market_signal_direction", value: signalDirection, updated_at: new Date().toISOString() },
      { key:"market_signal_text", value: signalText.trim(), updated_at: new Date().toISOString() },
    ]);
    if (error) return toast.error(error.message);
    toast.success("تم تحديث مؤشر الاتجاه");
  };
  const saveTabVisibility = async () => {
    const { error } = await supabase.from("settings").upsert([
      { key:"tab_deposit_visible", value: String(tabVisibility.deposit), updated_at: new Date().toISOString() },
      { key:"tab_withdraw_visible", value: String(tabVisibility.withdraw), updated_at: new Date().toISOString() },
      { key:"tab_local_visible", value: String(tabVisibility.local), updated_at: new Date().toISOString() },
      { key:"tab_shop_visible", value: String(tabVisibility.shop), updated_at: new Date().toISOString() },
      { key:"tab_referral_visible", value: String(tabVisibility.referral), updated_at: new Date().toISOString() },
    ]);
    if (error) return toast.error(error.message);
    toast.success("تم حفظ الأقسام الظاهرة للعملاء");
  };

  const saveDesc = async () => {
    await supabase.from("settings").upsert([{ key:"deposit_description", value:desc, updated_at: new Date().toISOString() }]);
    toast.success("تم الحفظ");
  };
  const saveWithdrawDesc = async () => {
    await supabase.from("settings").upsert([{ key:"withdraw_description", value:withdrawDesc, updated_at: new Date().toISOString() }]);
    toast.success("تم حفظ وصف السحب");
  };
  const saveSupport = async () => {
    await supabase.from("settings").upsert([
      { key:"support_url", value: supportUrl.trim(), updated_at: new Date().toISOString() },
      { key:"support_enabled", value: supportEnabled ? "true" : "false", updated_at: new Date().toISOString() },
    ]);
    toast.success("تم حفظ إعدادات الدعم");
  };
  const compressImg = (file: File) => new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = img.width * scale, h = img.height * scale;
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        res(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = rej;
      img.src = reader.result as string;
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
  const onWalletFile = async (file: File) => {
    setWUploading(true);
    try { const url = await compressImg(file); setWForm(f => ({ ...f, image_url: url })); }
    finally { setWUploading(false); }
  };
  const addWallet = async () => {
    if (!wForm.label || !wForm.address) return toast.error("أدخل الوصف والعنوان");
    const sort = (wallets[wallets.length-1]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from("deposit_wallets").insert({ ...wForm, sort_order: sort });
    if (error) return toast.error(error.message);
    setWForm({ label:"", address:"", network:"", currency:"", image_url:"" }); loadWallets(); toast.success("تمت الإضافة");
  };
  const delWallet = async (id: string) => {
    if (!confirm("حذف المحفظة؟")) return;
    await supabase.from("deposit_wallets").delete().eq("id", id); loadWallets();
  };
  const toggleWallet = async (w:any) => {
    await supabase.from("deposit_wallets").update({ is_active: !w.is_active }).eq("id", w.id); loadWallets();
  };
  const updateWalletImage = async (id: string, file: File) => {
    const url = await compressImg(file);
    await supabase.from("deposit_wallets").update({ image_url: url }).eq("id", id);
    loadWallets(); toast.success("تم تحديث الصورة");
  };
  const [yieldBusy, setYieldBusy] = useState(false);
  const runDailyYieldsFn = useServerFn(runDailyYields);
  const runYield = async () => {
    setYieldBusy(true);
    try {
      const result = await runDailyYieldsFn();
      if (result.ok) {
        const processed = result.processed ?? 0;
        toast.success(processed > 0 ? `تم إرسال أرباح اليوم إلى ${processed} حساب مفعّل` : "لا توجد دفعات جديدة: أرباح اليوم مضافة مسبقاً للحسابات المؤهلة");
      } else {
        toast.error("فشل التشغيل: " + (result.error ?? "حدث خطأ"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تشغيل الأرباح اليومية");
    } finally {
      setYieldBusy(false);
    }
  };
  const [gift, setGift] = useState("");
  const [giftBusy, setGiftBusy] = useState(false);
  const giftAll = async () => {
    const a = Number(gift);
    if (!a || a <= 0) return toast.error("أدخل قيمة موجبة");
    if (!confirm(`إضافة ${a}$ للعملاء المفعّلين الذين لديهم باقة فقط؟`)) return;
    setGiftBusy(true);
    const { data: users } = await supabase.from("profiles").select("id, balance").eq("is_active", true).not("package_id", "is", null);
    let n = 0;
    for (const u of users ?? []) {
      await supabase.from("profiles").update({ balance: Number(u.balance) + a }).eq("id", u.id);
      n++;
    }
    setGiftBusy(false); setGift("");
    toast.success(`تم إهداء ${a}$ لـ ${n} عميل`);
  };
  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-4 space-y-2">
        <div className="font-bold">وصف عملية الإيداع</div>
        <textarea rows={3} className="w-full bg-input border border-border rounded px-3 py-2" value={desc} onChange={e=>setDesc(e.target.value)} />
        <button onClick={saveDesc} className="btn-primary rounded px-4 py-2 font-bold">حفظ الوصف</button>
      </div>

      <div className="glass rounded-xl p-4 space-y-2">
        <div className="font-bold">وصف عملية السحب</div>
        <p className="text-xs text-muted-foreground">سيظهر للعميل داخل زر «وصف عملية السحب»، مع تنبيه ثابت أن السحب فقط على Tron.</p>
        <textarea rows={3} className="w-full bg-input border border-border rounded px-3 py-2" value={withdrawDesc} onChange={e=>setWithdrawDesc(e.target.value)} />
        <button onClick={saveWithdrawDesc} className="btn-primary rounded px-4 py-2 font-bold">حفظ وصف السحب</button>
      </div>

      <div className="glass rounded-xl p-4 space-y-2">
        <div className="font-bold">البونص الترحيبي للحسابات الجديدة</div>
        <p className="text-xs text-muted-foreground">يُضاف تلقائياً إلى رصيد كل حساب جديد عند التسجيل.</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bonusEnabled} onChange={e=>setBonusEnabled(e.target.checked)} />
          تفعيل العرض
        </label>
        <input type="number" min="0" step="0.01" className="w-full bg-input border border-border rounded px-3 py-2" placeholder="قيمة البونص بالدولار" value={bonusAmount} onChange={e=>setBonusAmount(e.target.value)} />
        <button onClick={saveBonus} className="btn-primary rounded px-4 py-2 font-bold">حفظ البونص</button>
      </div>

      <div className="glass rounded-xl p-4 space-y-2">
        <div className="font-bold">العروض — تحدي الإحالة</div>
        <p className="text-xs text-muted-foreground">التحكم بعرض «ادعُ 10 أشخاص واربح 94 USDT» الظاهر في الصفحة الرئيسية للعميل.</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={offerEnabled} onChange={e=>setOfferEnabled(e.target.checked)} />
          عرض التحدي للعملاء
        </label>
        <input className="w-full bg-input border border-border rounded px-3 py-2" placeholder="عنوان العرض (اختياري)" value={offerTitle} onChange={e=>setOfferTitle(e.target.value)} />
        <div className="grid sm:grid-cols-2 gap-2">
          <input type="number" min="1" step="1" className="bg-input border border-border rounded px-3 py-2" placeholder="عدد الإحالات المطلوبة" value={offerGoal} onChange={e=>setOfferGoal(e.target.value)} />
          <input type="number" min="0.01" step="0.01" className="bg-input border border-border rounded px-3 py-2" placeholder="قيمة المكافأة بالدولار" value={offerReward} onChange={e=>setOfferReward(e.target.value)} />
        </div>
        <button onClick={saveOffer} className="btn-primary rounded px-4 py-2 font-bold">حفظ العرض</button>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <div className="font-bold">مؤشر الاتجاه في الرئيسية</div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={signalEnabled} onChange={e=>setSignalEnabled(e.target.checked)} />
          عرض المؤشر للعملاء
        </label>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="اتجاه المؤشر">
          <button onClick={()=>setSignalDirection("up")} className={`rounded-lg border px-3 py-2 font-bold ${signalDirection === "up" ? "bg-success/20 text-success border-success" : "bg-input border-border"}`}>↑ مرتفع</button>
          <button onClick={()=>setSignalDirection("down")} className={`rounded-lg border px-3 py-2 font-bold ${signalDirection === "down" ? "bg-destructive/20 text-destructive border-destructive" : "bg-input border-border"}`}>↓ منخفض</button>
        </div>
        <textarea rows={3} dir="auto" className="w-full bg-input border border-border rounded px-3 py-2" placeholder="اكتب الأرقام والحروف التي تظهر تحت السهم" value={signalText} onChange={e=>setSignalText(e.target.value)} />
        <button onClick={saveSignal} className="btn-primary rounded px-4 py-2 font-bold">حفظ المؤشر</button>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <div className="font-bold">الأقسام الظاهرة للعملاء</div>
        <p className="text-xs text-muted-foreground">الصفحة الرئيسية تبقى ظاهرة دائماً.</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {([
            ["deposit", "الإيداع"], ["withdraw", "السحب"], ["local", "الإيداع المحلي"], ["shop", "الباقات"], ["referral", "الإحالة"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-sm">
              <span>{label}</span>
              <input type="checkbox" checked={tabVisibility[key]} onChange={e=>setTabVisibility(current=>({ ...current, [key]: e.target.checked }))} />
            </label>
          ))}
        </div>
        <button onClick={saveTabVisibility} className="btn-primary rounded px-4 py-2 font-bold">حفظ ظهور الأقسام</button>
      </div>


      <div className="glass rounded-xl p-4 space-y-2">
        <div className="font-bold">زر الدعم (المحادثة)</div>
        <p className="text-xs text-muted-foreground">رابط محادثة الدعم (واتساب، تلغرام، أي رابط). يمكن للعميل تحريك الزر في الشاشة والضغط عليه للانتقال إلى المحادثة.</p>
        <input dir="ltr" className="w-full bg-input border border-border rounded px-3 py-2 text-sm" placeholder="https://wa.me/..." value={supportUrl} onChange={e=>setSupportUrl(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={supportEnabled} onChange={e=>setSupportEnabled(e.target.checked)} />
          <span>عرض زر الدعم للعملاء</span>
        </label>
        <button onClick={saveSupport} className="btn-primary rounded px-4 py-2 font-bold">حفظ إعدادات الدعم</button>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <div className="font-bold">محافظ الإيداع</div>
        <ul className="space-y-2">
          {wallets.map(w=>(
            <li key={w.id} className="bg-secondary/40 rounded p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex gap-3 min-w-0 flex-1">
                  {w.image_url ? (
                    <img src={w.image_url} alt={w.label} className="w-12 h-12 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-background/40 grid place-items-center text-[10px] text-muted-foreground shrink-0">لا صورة</div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-sm">{w.label}</div>
                    <div className="text-[11px] text-muted-foreground">{w.currency ?? ""} {w.network ? `• ${w.network}` : ""}</div>
                    <div className="font-mono text-[11px] break-all mt-1">{w.address}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <label className="text-[11px] px-2 py-1 rounded bg-muted cursor-pointer text-center">
                    تغيير الصورة
                    <input type="file" accept="image/*" className="hidden" onChange={e=>e.target.files?.[0] && updateWalletImage(w.id, e.target.files[0])} />
                  </label>
                  <button onClick={()=>toggleWallet(w)} className="text-[11px] px-2 py-1 rounded bg-muted">{w.is_active?"إخفاء":"تفعيل"}</button>
                  <button onClick={()=>delWallet(w.id)} className="text-[11px] px-2 py-1 rounded bg-destructive/20 text-destructive">حذف</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-border pt-3 space-y-2">
          <div className="font-bold text-sm">إضافة محفظة</div>
          <input className="w-full bg-input border border-border rounded px-3 py-2" placeholder="الوصف (مثال: USDT - TRC20)" value={wForm.label} onChange={e=>setWForm({...wForm,label:e.target.value})}/>
          <div className="grid grid-cols-2 gap-2">
            <input className="bg-input border border-border rounded px-3 py-2" placeholder="نوع العملة (USDT, BTC...)" value={wForm.currency} onChange={e=>setWForm({...wForm,currency:e.target.value})}/>
            <input className="bg-input border border-border rounded px-3 py-2" placeholder="الشبكة" value={wForm.network} onChange={e=>setWForm({...wForm,network:e.target.value})}/>
          </div>
          <input className="w-full bg-input border border-border rounded px-3 py-2 font-mono text-xs" placeholder="العنوان" value={wForm.address} onChange={e=>setWForm({...wForm,address:e.target.value})}/>
          <div className="flex items-center gap-2">
            <label className="btn-primary rounded px-3 py-2 text-xs font-bold cursor-pointer">
              {wUploading ? "..." : "صورة المحفظة من الجهاز"}
              <input type="file" accept="image/*" className="hidden" onChange={e=>e.target.files?.[0] && onWalletFile(e.target.files[0])} />
            </label>
            {wForm.image_url && <img src={wForm.image_url} className="w-10 h-10 rounded object-cover" />}
            {wForm.image_url && <button onClick={()=>setWForm({...wForm,image_url:""})} className="text-destructive text-xs">إزالة</button>}
          </div>
          <button onClick={addWallet} className="btn-primary rounded px-4 py-2 font-bold">إضافة</button>
        </div>
      </div>


      <div className="glass rounded-xl p-4">
        <div className="font-bold mb-1">تشغيل الأرباح اليومية يدوياً</div>
        <p className="text-xs text-muted-foreground mb-3">تتم تلقائياً يومياً الساعة 00:14 بتوقيت بغداد. تُضاف لكل عميل مفعّل قيمة الربح المحددة في باقته مرة واحدة في اليوم وتتراكم في رصيده.</p>
        <button disabled={yieldBusy} onClick={runYield} className="btn-primary rounded px-4 py-2 font-bold disabled:opacity-50">{yieldBusy ? "جاري التشغيل..." : "تشغيل الآن"}</button>
      </div>

      <div className="glass rounded-xl p-4">
        <div className="font-bold mb-1">إهداء نقاط للحسابات المؤهلة</div>
        <p className="text-xs text-muted-foreground mb-3">يضيف القيمة المدخلة كهدية لرصيد العملاء المفعّلين الذين لديهم باقة فقط.</p>
        <div className="flex gap-2">
          <input type="number" step="0.01" className="flex-1 bg-input border border-border rounded px-3 py-2" placeholder="قيمة الهدية بالدولار" value={gift} onChange={e=>setGift(e.target.value)} />
          <button disabled={giftBusy} onClick={giftAll} className="btn-primary rounded px-4 py-2 font-bold">{giftBusy?"...":"إهداء للجميع"}</button>
        </div>
      </div>
    </div>
  );
}


function StatusBadge({ status }: { status: string }) {
  const map: any = { approved: "bg-success/20 text-success", rejected: "bg-destructive/20 text-destructive", pending: "bg-muted text-muted-foreground" };
  const labels: any = { approved: "مقبول", rejected: "مرفوض", pending: "معلّق" };
  return <span className={`text-xs px-2 py-1 rounded ${map[status]}`}>{labels[status]}</span>;
}
function Empty() { return <div className="glass rounded-xl p-8 text-center text-muted-foreground">لا توجد عناصر</div>; }

function HelpAdmin() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", description: "", video_url: "", sort_order: 0 });
  const load = () => (supabase as any).from("help_sections").select("*").order("sort_order").then(({ data }: any) => setItems(data ?? []));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.title.trim()) { toast.error("أدخل عنوان القسم"); return; }
    const { error } = await (supabase as any).from("help_sections").insert({
      title: form.title, description: form.description, video_url: form.video_url || null, sort_order: Number(form.sort_order) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("تمت الإضافة"); setForm({ title: "", description: "", video_url: "", sort_order: 0 }); load();
  };

  const update = async (id: string, patch: any) => {
    const { error } = await (supabase as any).from("help_sections").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا القسم؟")) return;
    await (supabase as any).from("help_sections").delete().eq("id", id);
    toast.success("تم الحذف"); load();
  };

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-4 space-y-2">
        <h3 className="font-bold">إضافة قسم مساعدة</h3>
        <input className="w-full bg-input border border-border rounded px-3 py-2" placeholder="عنوان القسم"
          value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <textarea rows={4} className="w-full bg-input border border-border rounded px-3 py-2" placeholder="الوصف الكامل"
          value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <input className="w-full bg-input border border-border rounded px-3 py-2" placeholder="رابط الفيديو (YouTube أو رابط mp4 — اختياري)"
          value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} />
        <input type="number" className="w-32 bg-input border border-border rounded px-3 py-2" placeholder="الترتيب"
          value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
        <button onClick={add} className="btn-primary rounded px-4 py-2 font-bold">إضافة</button>
      </div>

      {items.length === 0 && <Empty />}
      {items.map((s: any) => (
        <div key={s.id} className="glass rounded-xl p-4 space-y-2">
          <input defaultValue={s.title} onBlur={e => e.target.value !== s.title && update(s.id, { title: e.target.value })}
            className="w-full bg-input border border-border rounded px-3 py-2 font-bold" />
          <textarea rows={3} defaultValue={s.description} onBlur={e => e.target.value !== s.description && update(s.id, { description: e.target.value })}
            className="w-full bg-input border border-border rounded px-3 py-2 text-sm" />
          <input defaultValue={s.video_url ?? ""} onBlur={e => update(s.id, { video_url: e.target.value || null })}
            placeholder="رابط الفيديو" className="w-full bg-input border border-border rounded px-3 py-2 text-sm" />
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input type="checkbox" defaultChecked={s.is_active} onChange={e => update(s.id, { is_active: e.target.checked })} />
              مفعّل
            </label>
            <input type="number" defaultValue={s.sort_order} onBlur={e => update(s.id, { sort_order: Number(e.target.value) })}
              className="w-20 bg-input border border-border rounded px-2 py-1" />
            <button onClick={() => remove(s.id)} className="ml-auto bg-destructive/90 text-destructive-foreground rounded px-3 py-1 text-xs font-bold">حذف</button>
          </div>
        </div>
      ))}
    </div>
  );
}


function compressAdImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * scale; c.height = img.height * scale;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function AdvertisementsAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<{ id?: string; title: string; body: string; image_url: string; link_url: string }>({ title: "", body: "", image_url: "", link_url: "" });
  const db = supabase as any;
  const load = async () => {
    const { data } = await db.from("advertisements").select("*").order("sort_order").order("created_at");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!form.title.trim() && !form.image_url) return toast.error("أضف عنواناً أو صورة");
    const payload = { title: form.title.trim(), body: form.body.trim(), image_url: form.image_url || null, link_url: form.link_url.trim() || null };
    const { error } = form.id
      ? await db.from("advertisements").update(payload).eq("id", form.id)
      : await db.from("advertisements").insert({ ...payload, sort_order: rows.length, is_active: true });
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    setForm({ title: "", body: "", image_url: "", link_url: "" });
    load();
  };
  const move = async (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= rows.length) return;
    const a = rows[i], b = rows[j];
    await db.from("advertisements").update({ sort_order: j }).eq("id", a.id);
    await db.from("advertisements").update({ sort_order: i }).eq("id", b.id);
    load();
  };
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="font-bold">{form.id ? "تعديل إعلان" : "إضافة إعلان"}</div>
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="العنوان" className="w-full bg-input rounded-lg px-3 py-2" />
        <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="نص الإعلان" className="w-full bg-input rounded-lg px-3 py-2 min-h-20" />
        <input value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} placeholder="رابط (اختياري)" className="w-full bg-input rounded-lg px-3 py-2" dir="ltr" />
        <input type="file" accept="image/*" onChange={async e => { const f = e.target.files?.[0]; if (f) setForm({ ...form, image_url: await compressAdImage(f) }); }} />
        {form.image_url && <div className="flex items-center gap-2"><img src={form.image_url} alt="" className="h-20 rounded-lg" /><button onClick={() => setForm({ ...form, image_url: "" })} className="text-destructive text-sm">إزالة الصورة</button></div>}
        <div className="flex gap-2">
          <button onClick={save} className="btn-primary px-4 py-2 rounded-lg font-bold">حفظ</button>
          {form.id && <button onClick={() => setForm({ title: "", body: "", image_url: "", link_url: "" })} className="glass px-4 py-2 rounded-lg">إلغاء</button>}
        </div>
      </div>
      {rows.map((r, i) => (
        <div key={r.id} className="glass rounded-2xl p-3 flex items-center gap-3">
          {r.image_url && <img src={r.image_url} alt="" className="h-14 w-14 object-cover rounded-lg" />}
          <div className="flex-1 min-w-0"><div className="font-bold truncate">{r.title || "—"}</div><div className="text-xs text-muted-foreground truncate">{r.body}</div></div>
          <button onClick={() => move(i, -1)} aria-label="للأعلى"><ChevronUp className="w-4 h-4" /></button>
          <button onClick={() => move(i, 1)} aria-label="للأسفل"><ChevronDown className="w-4 h-4" /></button>
          <button onClick={async () => { await db.from("advertisements").update({ is_active: !r.is_active }).eq("id", r.id); load(); }} className="text-xs glass px-2 py-1 rounded">{r.is_active ? "إخفاء" : "إظهار"}</button>
          <button onClick={() => setForm({ id: r.id, title: r.title ?? "", body: r.body ?? "", image_url: r.image_url ?? "", link_url: r.link_url ?? "" })} className="text-xs glass px-2 py-1 rounded">تعديل</button>
          <button onClick={async () => { if (!confirm("حذف الإعلان؟")) return; await db.from("advertisements").delete().eq("id", r.id); load(); }} className="text-xs bg-destructive/90 px-2 py-1 rounded">حذف</button>
        </div>
      ))}
    </div>
  );
}

function NotificationsAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("");
  const [search, setSearch] = useState("");
  const db = supabase as any;
  const load = async () => {
    const { data } = await db.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
    db.from("profiles").select("id,full_name,email,referral_code").order("created_at", { ascending: false }).then(({ data }: any) => setUsers(data ?? []));
  }, []);
  const filtered = users.filter(u => !search || [u.full_name, u.email, u.referral_code].some((v: string) => v?.toLowerCase().includes(search.toLowerCase()))).slice(0, 30);
  const name = (id: string) => { const u = users.find(x => x.id === id); return u ? `${u.full_name || u.email} (${u.referral_code})` : id; };
  const send = async () => {
    if (!message.trim()) return toast.error("اكتب الإشعار");
    const { error } = await db.from("notifications").insert({ message: message.trim(), target_user_id: target || null });
    if (error) return toast.error(error.message);
    toast.success("تم الإرسال"); setMessage(""); load();
  };
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4 space-y-3">
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="نص الإشعار" className="w-full bg-input rounded-lg px-3 py-2 min-h-20" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن عميل بالاسم أو المعرّف" className="w-full bg-input rounded-lg px-3 py-2" />
        <select value={target} onChange={e => setTarget(e.target.value)} className="w-full bg-input rounded-lg px-3 py-2">
          <option value="">جميع العملاء</option>
          {filtered.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email} — {u.referral_code}</option>)}
        </select>
        <button onClick={send} className="btn-primary px-4 py-2 rounded-lg font-bold">إرسال</button>
      </div>
      {rows.map(r => (
        <div key={r.id} className="glass rounded-2xl p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm">{r.message}</div>
            <div className="text-xs text-muted-foreground">{r.target_user_id ? name(r.target_user_id) : "جميع العملاء"} · {new Date(r.created_at).toLocaleString("ar")}</div>
          </div>
          <button onClick={async () => { await db.from("notifications").delete().eq("id", r.id); load(); }} className="text-xs bg-destructive/90 px-2 py-1 rounded">حذف</button>
        </div>
      ))}
    </div>
  );
}
