import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/auth/forgot")({
  head: () => ({ meta: [{ title: "استرجاع كلمة المرور — Polone" }, { name: "description", content: "استعادة الوصول إلى حساب Polone." }, { property: "og:title", content: "استرجاع كلمة المرور — Polone" }, { property: "og:description", content: "استعادة الوصول إلى حساب Polone." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md glass rounded-3xl p-8">
        <div className="mb-5 flex justify-center"><BrandLogo className="h-14 w-14" nameClassName="text-xl font-extrabold" /></div>
        <Link to="/auth/login" className="text-xs text-muted-foreground">→ العودة</Link>
        <h1 className="text-3xl font-black mt-2 text-gradient">استرجاع كلمة المرور</h1>
        {sent ? (
          <div className="mt-6 space-y-3 text-sm">
            <p>أرسلنا رابط إعادة تعيين كلمة المرور إلى <b>{email}</b>.</p>
            <p className="text-muted-foreground">افتح البريد واضغط على الرابط لتكتب كلمة مرور جديدة. تحقق من مجلد الرسائل غير المرغوبة (Spam) إن لم تجده.</p>
            <button onClick={() => setSent(false)} className="glass w-full rounded-xl py-3 font-bold">إعادة الإرسال</button>
          </div>
        ) : (
          <form onSubmit={send} className="mt-6 space-y-3">
            <input type="email" required className="w-full bg-input border border-border rounded-xl px-4 py-3"
              placeholder="البريد الإلكتروني" value={email} onChange={e => setEmail(e.target.value)} />
            <button disabled={loading} className="btn-primary w-full rounded-xl py-3 font-bold">{loading ? "..." : "إرسال رابط إعادة التعيين"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
