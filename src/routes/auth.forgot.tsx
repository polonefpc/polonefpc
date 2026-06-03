import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/forgot")({ component: Forgot });

function Forgot() {
  const nav = useNavigate();
  const [step, setStep] = useState<"email" | "verify">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/forgot`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إرسال كود الاسترجاع إلى بريدك");
    setStep("verify");
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { toast.error("كلمة المرور يجب 8 أحرف على الأقل"); return; }
    setLoading(true);
    const { error: e1 } = await supabase.auth.verifyOtp({ email, token: otp, type: "recovery" });
    if (e1) { setLoading(false); toast.error(e1.message); return; }
    const { error: e2 } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (e2) { toast.error(e2.message); return; }
    toast.success("تم تغيير كلمة المرور");
    nav({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md glass rounded-3xl p-8">
        <Link to="/auth/login" className="text-xs text-muted-foreground">→ العودة</Link>
        <h1 className="text-3xl font-black mt-2 text-gradient">استرجاع كلمة المرور</h1>

        {step === "email" ? (
          <form onSubmit={send} className="mt-6 space-y-3">
            <input type="email" required className="w-full bg-input border border-border rounded-xl px-4 py-3"
              placeholder="البريد الإلكتروني" value={email} onChange={e => setEmail(e.target.value)} />
            <button disabled={loading} className="btn-primary w-full rounded-xl py-3 font-bold">{loading ? "..." : "إرسال الكود"}</button>
          </form>
        ) : (
          <form onSubmit={reset} className="mt-6 space-y-3">
            <p className="text-sm">أدخل الكود من بريد <b>{email}</b> وكلمة مرور جديدة</p>
            <input inputMode="numeric" maxLength={6} className="w-full text-center text-2xl tracking-widest bg-input border border-border rounded-xl px-4 py-3"
              placeholder="------" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,""))} />
            <input type="password" className="w-full bg-input border border-border rounded-xl px-4 py-3"
              placeholder="كلمة مرور جديدة" value={pw} onChange={e => setPw(e.target.value)} />
            <button disabled={loading} className="btn-primary w-full rounded-xl py-3 font-bold">{loading ? "..." : "تأكيد"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
