import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const Route = createFileRoute("/auth/signup")({
  validateSearch: (s: Record<string, unknown>) => ({ ref: (s.ref as string) || "" }),
  component: Signup,
});

const schema = z.object({
  full_name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

function Signup() {
  const nav = useNavigate();
  const { ref } = useSearch({ from: "/auth/signup" });
  const [step, setStep] = useState<"form" | "otp">("form");
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: form.full_name, ref: ref || undefined },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إرسال كود التحقق إلى بريدك");
    setStep("otp");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) { toast.error("أدخل الكود المكوّن من 6 أرقام"); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email: form.email, token: otp, type: "email" });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تفعيل حسابك");
    nav({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md glass rounded-3xl p-8">
        <Link to="/" className="text-xs text-muted-foreground">→ العودة</Link>
        <h1 className="text-3xl font-black mt-2 text-gradient">إنشاء حساب جديد</h1>
        <p className="text-sm text-muted-foreground mt-1">انضم إلى polone وابدأ الاستثمار</p>

        {step === "form" ? (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input className="w-full bg-input border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
              placeholder="الاسم الكامل" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />
            <input type="email" className="w-full bg-input border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
              placeholder="البريد الإلكتروني" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <input type="password" className="w-full bg-input border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
              placeholder="كلمة المرور (8 أحرف على الأقل)" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            {ref && <div className="text-xs text-primary">رمز إحالة مفعّل: {ref.slice(0, 8)}…</div>}
            <button disabled={loading} className="btn-primary w-full rounded-xl py-3 font-bold">{loading ? "..." : "إرسال كود التحقق"}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-3">
            <p className="text-sm">أدخل الكود الذي وصل إلى <b>{form.email}</b></p>
            <input inputMode="numeric" maxLength={6} className="w-full text-center text-2xl tracking-widest bg-input border border-border rounded-xl px-4 py-3"
              placeholder="------" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} />
            <button disabled={loading} className="btn-primary w-full rounded-xl py-3 font-bold">{loading ? "..." : "تأكيد وتسجيل الدخول"}</button>
            <button type="button" onClick={() => setStep("form")} className="text-xs text-muted-foreground w-full">رجوع</button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-muted-foreground">
          لديك حساب؟ <Link to="/auth/login" className="text-primary font-bold">دخول</Link>
        </div>
      </div>
    </div>
  );
}
