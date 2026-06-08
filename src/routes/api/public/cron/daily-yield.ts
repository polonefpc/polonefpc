import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/cron/daily-yield")({
  server: {
    handlers: {
      POST: async () => {
        const today = new Date().toISOString().slice(0, 10);
        const { data: processed, error } = await (supabaseAdmin as any).rpc("apply_daily_yields", { _apply_date: today });
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true, processed, day: today });
      },
    },
  },
});
