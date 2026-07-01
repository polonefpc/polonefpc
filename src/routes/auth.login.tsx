import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/login")({ component: Login });

function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(form);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("مرحباً بعودتك");
    nav({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md glass rounded-3xl p-8">
        <Link to="/" className="text-xs text-muted-foreground">→ العودة</Link>
        <h1 className="text-3xl font-black mt-2 text-gradient">تسجيل الدخول</h1>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input type="email" required className="w-full bg-input border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
            placeholder="البريد الإلكتروني" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <input type="password" required className="w-full bg-input border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
            placeholder="كلمة المرور" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          <button disabled={loading} className="btn-primary w-full rounded-xl py-3 font-bold">{loading ? "..." : "دخول"}</button>
        </form>
        <div className="mt-4 text-center text-sm">
          <Link to="/auth/forgot" className="text-muted-foreground hover:text-primary">نسيت كلمة المرور؟</Link>
        </div>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <span>ليس لديك حساب؟</span><Link to="/auth/signup" className="text-primary font-bold"> إنشاء حساب</Link>
        </div>
      </div>
    </div>
  );
}
