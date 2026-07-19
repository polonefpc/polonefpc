import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type OAuthData = {
  client?: { name?: string; client_name?: string; redirect_uri?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
  scopes?: string[];
};

// Beta namespace: minimal typed wrapper so we can call the three helpers safely.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthData | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthData | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthData | null; error: { message: string } | null }>;
};
function oauth(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth/login", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center p-6 text-center">
      <div className="glass rounded-3xl p-6 max-w-md">
        <h1 className="text-xl font-bold mb-2">تعذّر تحميل طلب الموافقة</h1>
        <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as OAuthData | null;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "تطبيق خارجي";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("لم يتم إرجاع رابط تحويل من خادم المصادقة."); return; }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md glass rounded-3xl p-8 space-y-4">
        <h1 className="text-2xl font-black text-gradient">ربط {clientName} بحسابك</h1>
        <p className="text-sm text-muted-foreground">
          سيتمكّن <b>{clientName}</b> من استخدام أدوات Polone باسمك أثناء تسجيل دخولك.
          هذا لا يتجاوز صلاحيات التطبيق أو سياسات الحماية.
        </p>
        <ul className="text-sm space-y-1 list-disc pr-5 text-muted-foreground">
          <li>قراءة ملفك الشخصي (الرصيد، معرّف الحساب، نوع الباقة).</li>
          <li>قراءة سجل الأرباح اليومية.</li>
          <li>قراءة عمليات الإيداع والسحب والتحويل الخاصة بك.</li>
        </ul>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button disabled={busy} onClick={() => decide(true)}
            className="btn-primary flex-1 rounded-xl py-3 font-bold">
            {busy ? "..." : "موافقة"}
          </button>
          <button disabled={busy} onClick={() => decide(false)}
            className="flex-1 rounded-xl py-3 font-bold glass border border-border">
            رفض
          </button>
        </div>
      </div>
    </main>
  );
}
