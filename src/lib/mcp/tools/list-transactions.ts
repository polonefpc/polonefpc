import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_transactions",
  title: "List my transactions",
  description:
    "Return the signed-in user's recent deposit requests, withdrawal requests, and point transfers.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    const [dep, wd, tf] = await Promise.all([
      sb.from("deposit_requests").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(limit),
      sb.from("withdrawals").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(limit),
      sb.from("transfers").select("*").or(`from_user.eq.${uid},to_user.eq.${uid}`).order("created_at", { ascending: false }).limit(limit),
    ]);
    const err = dep.error || wd.error || tf.error;
    if (err) return { content: [{ type: "text", text: err.message }], isError: true };
    const payload = { deposits: dep.data, withdrawals: wd.data, transfers: tf.data };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
