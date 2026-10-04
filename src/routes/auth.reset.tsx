import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/auth/reset")({
  head: () => ({ meta: [{ title: "كلمة مرور جديدة | Polone" }, { name: "description", content: "تعيين كلمة مرور جديدة لحساب Polone" }] }),
  component: Reset,
});

function Reset() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error("كلمة المرور يجب 8 أحرف على الأقل");
    if (pw !== pw2) return toast.error("كلمتا المرور غير متطابقتين");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم تغيير كلمة المرور");
    nav({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md glass rounded-3xl p-8">
        <div className="mb-5 flex justify-center"><BrandLogo className="h-14 w-14" nameClassName="text-xl font-extrabold" /></div>
        <h1 className="text-3xl font-black text-gradient">كلمة مرور جديدة</h1>
        {!ready ? (
          <p className="mt-6 text-sm text-muted-foreground">افتح هذه الصفحة من الرابط الذي وصلك على البريد.</p>
        ) : (
          <form onSubmit={save} className="mt-6 space-y-3">
            <input type="password" className="w-full bg-input border border-border rounded-xl px-4 py-3" placeholder="كلمة المرور الجديدة" value={pw} onChange={e => setPw(e.target.value)} />
            <input type="password" className="w-full bg-input border border-border rounded-xl px-4 py-3" placeholder="تأكيد كلمة المرور" value={pw2} onChange={e => setPw2(e.target.value)} />
            <button disabled={loading} className="btn-primary w-full rounded-xl py-3 font-bold">{loading ? "..." : "حفظ"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
