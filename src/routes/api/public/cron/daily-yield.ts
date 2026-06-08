import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/daily-yield")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const today = new Date().toISOString().slice(0, 10);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: processed, error } = await (supabaseAdmin as any).rpc("apply_daily_yields", { _apply_date: today });
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true, processed, day: today });
      },
    },
  },
});
