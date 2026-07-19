import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { runDailyYields } from "@/lib/admin.functions";


export const Route = createFileRoute("/_authenticated/admin")({ component: Admin });

type Tab = "deposits" | "withdrawals" | "orders" | "users" | "products" | "agents" | "contacts" | "settings" | "help";
const TABS: { id: Tab; label: string }[] = [
  { id: "deposits", label: "طلبات الإيداع" },
  { id: "withdrawals", label: "طلبات السحب" },
  { id: "orders", label: "طلبات المنتجات" },
  { id: "users", label: "المستخدمون" },
  { id: "products", label: "المنتجات" },
  { id: "contacts", label: "وكلاء الإيداع" },
  { id: "agents", label: "تعيين وكلاء" },
  { id: "help", label: "أقسام المساعدة" },
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
    <div className="min-h-screen">
      <header className="px-4 py-3 glass border-b flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-1 text-sm"><ArrowLeft className="w-4 h-4" /> العودة</Link>
        <h1 className="font-extrabold">لوحة الأدمن</h1>
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
        {tab === "products" && <Products />}
        {tab === "contacts" && <Contacts />}
        {tab === "agents" && <Agents />}
        {tab === "help" && <HelpAdmin />}
        
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
        </div>
      ))}
    </div>
  );
}

function Products() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ name:"", description:"", image_url:"", price:"" });
  const [uploading, setUploading] = useState(false);
  const load = () => supabase.from("products").select("*").order("created_at",{ascending:false}).then(({data})=>setItems(data ?? []));
  useEffect(()=>{load();},[]);
  const onFile = async (file: File) => {
    if (file.size > 800 * 1024) {
      // compress via canvas
      setUploading(true);
      const dataUrl = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const max = 800;
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const w = img.width * scale, h = img.height * scale;
            const c = document.createElement("canvas");
            c.width = w; c.height = h;
            c.getContext("2d")!.drawImage(img, 0, 0, w, h);
            res(c.toDataURL("image/jpeg", 0.75));
          };
          img.onerror = rej;
          img.src = reader.result as string;
        };
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      setForm(f => ({ ...f, image_url: dataUrl }));
      setUploading(false);
    } else {
      const reader = new FileReader();
      reader.onload = () => setForm(f => ({ ...f, image_url: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };
  const add = async () => {
    if (!form.name || !form.price) return toast.error("اسم وسعر");
    await supabase.from("products").insert({ ...form, price: Number(form.price) });
    setForm({name:"",description:"",image_url:"",price:""}); load();
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
          {form.image_url && <img src={form.image_url} className="w-16 h-16 rounded object-cover" />}
          {form.image_url && <button onClick={()=>setForm({...form,image_url:""})} className="text-destructive text-xs">إزالة</button>}
        </div>
        <textarea className="bg-input border border-border rounded px-3 py-2 sm:col-span-2" placeholder="الوصف" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} />
        <button onClick={add} className="btn-primary rounded px-4 py-2 font-bold sm:col-span-2">إضافة منتج</button>
      </div>
      <div className="space-y-2">
        {items.map(p=>(
          <div key={p.id} className="glass rounded-xl p-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              {p.image_url && <img src={p.image_url} className="w-12 h-12 rounded object-cover" />}
              <div>
                <div className="font-bold">{p.name}</div>
                <div className="text-xs">${p.price}</div>
              </div>
            </div>
            <button onClick={async()=>{await supabase.from("products").delete().eq("id",p.id);load();}} className="text-destructive text-sm">حذف</button>
          </div>
        ))}
      </div>
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
  const load = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role","agent");
    const ids = roles?.map(r=>r.user_id) ?? [];
    const { data: profs } = ids.length ? await supabase.from("profiles").select("*").in("id", ids) : { data: [] as any[] };
    const { data: bals } = ids.length ? await supabase.from("agent_balances").select("*").in("user_id", ids) : { data: [] as any[] };
    setItems((profs??[]).map(p=>({...p, agent_balance: bals?.find(b=>b.user_id===p.id)?.balance ?? 0 })));
  };
  useEffect(()=>{load();},[]);
  const promote = async () => {
    if (!search) return;
    const { data: u } = await supabase.from("profiles").select("id,email").or(`email.eq.${search},id.eq.${search}`).maybeSingle();
    if (!u) return toast.error("لم يوجد المستخدم");
    await supabase.from("user_roles").insert({ user_id: u.id, role: "agent" }).then(({error})=>{
      if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    });
    await supabase.from("agent_balances").upsert({ user_id: u.id, balance: 0 });
    toast.success("تم تعيين الوكيل"); setSearch(""); load();
  };
  const setBalance = async (id:string) => {
    const a = Number(bal[id]); if (a < 0) return;
    await supabase.from("agent_balances").upsert({ user_id: id, balance: a, updated_at: new Date().toISOString() });
    toast.success("تم التحديث"); setBal({...bal,[id]:""}); load();
  };
  const revoke = async (id:string) => {
    await supabase.from("user_roles").delete().eq("user_id",id).eq("role","agent");
    toast.success("تم"); load();
  };
  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-4 flex gap-2">
        <input className="flex-1 bg-input border border-border rounded px-3 py-2" placeholder="إيميل أو معرّف المستخدم" value={search} onChange={e=>setSearch(e.target.value)} />
        <button onClick={promote} className="btn-primary rounded px-4 py-2 font-bold">تعيين وكيل</button>
      </div>
      {items.map(u=>(
        <div key={u.id} className="glass rounded-xl p-4">
          <div className="flex justify-between">
            <div>
              <div className="font-bold">{u.full_name ?? u.email}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
              <div className="text-sm mt-1">رصيد الوكيل: <b>${Number(u.agent_balance).toFixed(2)}</b></div>
            </div>
            <button onClick={()=>revoke(u.id)} className="text-destructive text-xs">إلغاء التعيين</button>
          </div>
          <div className="flex gap-2 mt-2">
            <input className="bg-input border border-border rounded px-2 py-1 text-sm w-32" placeholder="رصيد جديد" type="number" value={bal[u.id]??""} onChange={e=>setBal({...bal,[u.id]:e.target.value})} />
            <button onClick={()=>setBalance(u.id)} className="btn-primary px-3 py-1 rounded text-xs font-bold">حفظ</button>
          </div>
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
  const loadWallets = () => supabase.from("deposit_wallets").select("*").order("sort_order").then(({data})=>setWallets(data ?? []));
  useEffect(()=>{
    supabase.from("settings").select("*").eq("key","deposit_description").maybeSingle().then(({data})=>setDesc(data?.value ?? ""));
    supabase.from("settings").select("*").eq("key","withdraw_description").maybeSingle().then(({data})=>setWithdrawDesc(data?.value ?? ""));
    supabase.from("settings").select("*").eq("key","support_url").maybeSingle().then(({data})=>setSupportUrl(data?.value ?? ""));
    supabase.from("settings").select("*").eq("key","support_enabled").maybeSingle().then(({data})=>setSupportEnabled((data?.value ?? "false") === "true"));
    loadWallets();
  },[]);
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
    const result = await runDailyYieldsFn();
    setYieldBusy(false);
    if (result.ok) {
      const processed = result.processed ?? 0;
      toast.success(processed > 0 ? `تم إرسال الأرباح إلى ${processed} حساب` : "أرباح اليوم مضافة مسبقاً لكل الحسابات المؤهلة");
    } else {
      toast.error("فشل التشغيل: " + (result.error ?? "حدث خطأ"));
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
        <p className="text-xs text-muted-foreground mb-3">تتم تلقائياً يومياً الساعة 00:14. تُضاف لكل عميل مفعّل قيمة باقته اليومية مرة واحدة في اليوم.</p>
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

