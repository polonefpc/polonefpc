import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({ component: Admin });

type Tab = "deposits" | "withdrawals" | "orders" | "users" | "products" | "agents" | "contacts" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "deposits", label: "طلبات الإيداع" },
  { id: "withdrawals", label: "طلبات السحب" },
  { id: "orders", label: "طلبات المنتجات" },
  { id: "users", label: "المستخدمون" },
  { id: "products", label: "المنتجات" },
  { id: "contacts", label: "وكلاء الإيداع" },
  { id: "agents", label: "تعيين وكلاء" },
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
        {tab === "settings" && <Settings />}
      </div>
    </div>
  );
}

function Deposits() {
  const [items, setItems] = useState<any[]>([]);
  const load = () => supabase.from("deposit_requests")
    .select("*,profiles!deposit_requests_user_profile_fkey(email,full_name),packages(name,price,daily_rate)")
    .order("created_at",{ascending:false}).then(({data})=>setItems(data ?? []));
  useEffect(()=>{ load(); },[]);
  const decide = async (r: any, status: "approved" | "rejected") => {
    if (status === "approved") {
      const { error } = await supabase.from("profiles").update({
        is_active: true, package_id: r.package_id, activated_at: new Date().toISOString()
      }).eq("id", r.user_id);
      if (error) return toast.error(error.message);
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
              <div className="text-xs text-muted-foreground">{r.profiles?.email}</div>
              <div className="text-sm mt-1">{r.packages?.name} • ${r.packages?.price} • {r.packages?.daily_rate}%</div>
              {r.tx_hash && <div className="text-xs font-mono mt-1 break-all">{r.tx_hash}</div>}
            </div>
            <StatusBadge status={r.status} />
          </div>
          {r.status === "pending" && (
            <div className="flex gap-2 mt-3">
              <button onClick={()=>decide(r,"approved")} className="bg-success/90 text-success-foreground px-3 py-1.5 rounded-lg text-sm font-bold">قبول وتفعيل</button>
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
  const [bonus, setBonus] = useState<Record<string,string>>({});
  const load = () => supabase.from("profiles").select("*,packages(name,price)").order("created_at",{ascending:false}).then(({data})=>setItems(data ?? []));
  useEffect(()=>{load();},[]);
  const addPoints = async (id:string) => {
    const a = Number(bonus[id]); if (!a) return;
    const u = items.find(x=>x.id===id);
    await supabase.from("profiles").update({ balance: Number(u.balance) + a }).eq("id", id);
    toast.success("تمت إضافة النقاط"); setBonus({...bonus,[id]:""}); load();
  };
  const zero = async (id:string) => {
    await supabase.from("profiles").update({ balance: 0 }).eq("id", id); toast.success("تم التصفير"); load();
  };
  const toggleActive = async (u:any) => {
    await supabase.from("profiles").update({ is_active: !u.is_active }).eq("id", u.id); load();
  };
  return (
    <div className="space-y-2">
      {items.map(u=>(
        <div key={u.id} className="glass rounded-xl p-4">
          <div className="flex justify-between">
            <div>
              <div className="font-bold">{u.full_name ?? u.email}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
              <div className="text-xs font-mono break-all mt-1">{u.id}</div>
              <div className="text-sm mt-1">رصيد: <b>${u.balance}</b> • {u.packages?.name ?? "بدون باقة"} • إحالات: {u.referral_count}</div>
            </div>
            <span className={`text-xs px-2 py-1 rounded h-fit ${u.is_active?"bg-success/20 text-success":"bg-destructive/20 text-destructive"}`}>{u.is_active?"مفعّل":"محظور"}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 items-center">
            <input className="bg-input border border-border rounded px-2 py-1 text-sm w-24" placeholder="نقاط+" value={bonus[u.id]??""} onChange={e=>setBonus({...bonus,[u.id]:e.target.value})} />
            <button onClick={()=>addPoints(u.id)} className="btn-primary px-2.5 py-1 rounded text-xs font-bold">إضافة</button>
            <button onClick={()=>zero(u.id)} className="bg-destructive/80 px-2.5 py-1 rounded text-xs font-bold">تصفير</button>
            <button onClick={()=>toggleActive(u)} className="glass px-2.5 py-1 rounded text-xs font-bold">{u.is_active?"حظر":"تفعيل"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Products() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ name:"", description:"", image_url:"", price:"" });
  const load = () => supabase.from("products").select("*").order("created_at",{ascending:false}).then(({data})=>setItems(data ?? []));
  useEffect(()=>{load();},[]);
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
        <input className="bg-input border border-border rounded px-3 py-2 sm:col-span-2" placeholder="رابط الصورة" value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})} />
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
  const [s, setS] = useState({ deposit_wallet:"", deposit_network:"" });
  useEffect(()=>{
    supabase.from("settings").select("*").in("key",["deposit_wallet","deposit_network"]).then(({data})=>{
      const m:any={}; data?.forEach(r=>m[r.key]=r.value); setS({deposit_wallet:m.deposit_wallet??"",deposit_network:m.deposit_network??""});
    });
  },[]);
  const save = async () => {
    await supabase.from("settings").upsert([
      { key:"deposit_wallet", value:s.deposit_wallet, updated_at: new Date().toISOString() },
      { key:"deposit_network", value:s.deposit_network, updated_at: new Date().toISOString() },
    ]);
    toast.success("تم الحفظ");
  };
  return (
    <div className="glass rounded-xl p-4 space-y-2">
      <label className="text-xs text-muted-foreground">عنوان محفظة الإيداع</label>
      <input className="w-full bg-input border border-border rounded px-3 py-2" value={s.deposit_wallet} onChange={e=>setS({...s,deposit_wallet:e.target.value})} />
      <label className="text-xs text-muted-foreground">الشبكة</label>
      <input className="w-full bg-input border border-border rounded px-3 py-2" value={s.deposit_network} onChange={e=>setS({...s,deposit_network:e.target.value})} />
      <button onClick={save} className="btn-primary rounded px-4 py-2 font-bold">حفظ</button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: any = { approved: "bg-success/20 text-success", rejected: "bg-destructive/20 text-destructive", pending: "bg-muted text-muted-foreground" };
  const labels: any = { approved: "مقبول", rejected: "مرفوض", pending: "معلّق" };
  return <span className={`text-xs px-2 py-1 rounded ${map[status]}`}>{labels[status]}</span>;
}
function Empty() { return <div className="glass rounded-xl p-8 text-center text-muted-foreground">لا توجد عناصر</div>; }
