import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClientShell, HomeTab, DepositTab, WithdrawTab, LocalTab, ShopTab, ReferralTab, useProfile } from "@/components/client-app";
import type { Role } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const state = useProfile();
  const [roles, setRoles] = useState<Role[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      const rs = (r?.map(x => x.role as Role)) ?? [];
      setRoles(rs);
      // agent → redirect to /agent
      if (rs.includes("agent") && !rs.includes("admin")) nav({ to: "/agent" });
    });
  }, [nav]);

  if (state.loading || !state.profile) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <ClientShell userEmail={state.user.email!} roles={roles}>
      {(tab) => {
        switch (tab) {
          case "home": return <HomeTab {...state} />;
          case "deposit": return <DepositTab {...state} />;
          case "withdraw": return <WithdrawTab {...state} />;
          case "local": return <LocalTab />;
          case "shop": return <ShopTab {...state} />;
          case "referral": return <ReferralTab {...state} />;
        }
      }}
    </ClientShell>
  );
}
