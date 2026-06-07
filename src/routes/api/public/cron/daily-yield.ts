import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/cron/daily-yield")({
  server: {
    handlers: {
      POST: async () => {
        const today = new Date().toISOString().slice(0, 10);
        // Active users with a package, activated at least 24h ago
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: users, error } = await supabaseAdmin
          .from("profiles")
          .select("id, balance, package_id, referral_count, activated_at, packages(daily_rate)")
          .eq("is_active", true)
          .not("package_id", "is", null)
          .lte("activated_at", cutoff);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let processed = 0;
        for (const u of users ?? []) {
          const { data: existing } = await supabaseAdmin
            .from("daily_yields")
            .select("id")
            .eq("user_id", u.id)
            .eq("applied_on", today)
            .maybeSingle();
          if (existing) continue;

          // daily_rate is fixed USDT/day; +0.5 USDT per referral as bonus
          const base = Number((u as any).packages?.daily_rate ?? 0);
          const bonus = Number(u.referral_count ?? 0) * 0.5;
          const inc = base + bonus;
          const next = Number(u.balance) + inc;

          await supabaseAdmin.from("profiles").update({ balance: next }).eq("id", u.id);
          await supabaseAdmin.from("daily_yields").insert({
            user_id: u.id, amount: inc, rate: base, applied_on: today,
          });
          processed++;
        }
        return Response.json({ ok: true, processed, day: today });
      },
    },
  },
});
