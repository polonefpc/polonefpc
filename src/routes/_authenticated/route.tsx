import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession reads the stored session (refreshing it if needed) so a brief network hiccup doesn't log the user out
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return { user: data.session.user };
    const { data: fresh } = await supabase.auth.getUser();
    if (!fresh.user) throw redirect({ to: "/auth/login" });
    return { user: fresh.user };
  },
  component: () => <Outlet />,
});
