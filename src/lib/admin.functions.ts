import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const runDailyYields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) return { ok: false, error: "غير مصرح", processed: 0 };

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date());
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).rpc("apply_daily_yields", {
      _apply_date: today,
    });

    if (error) return { ok: false, error: error.message, processed: 0 };
    return { ok: true, error: null, processed: Number(data ?? 0) };
  });
async function assertAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("غير مصرح");
}

export const listAccountsActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [p, d, w, y, t] = await Promise.all([
      db.from("profiles").select("id,email,full_name,referral_code,balance,is_active,package_id,created_at").order("created_at", { ascending: false }),
      db.from("deposit_requests").select("user_id,created_at").order("created_at", { ascending: false }),
      db.from("withdrawals").select("user_id,created_at").order("created_at", { ascending: false }),
      db.from("daily_yields").select("user_id,created_at").order("created_at", { ascending: false }),
      db.from("transfers").select("from_user,to_user,created_at").order("created_at", { ascending: false }),
    ]);
    const first = (rows: any[], key = "user_id") => { const m: Record<string, string> = {}; for (const r of rows ?? []) if (!m[r[key]]) m[r[key]] = r.created_at; return m; };
    const dep = first(d.data), wd = first(w.data), yl = first(y.data), tf = first(t.data, "from_user"), tt = first(t.data, "to_user");
    const { data: s } = await db.from("settings").select("value").eq("key", "inactive_cleanup_enabled").maybeSingle();
    const accounts = (p.data ?? []).map((a: any) => {
      const dates = [dep[a.id], wd[a.id], yl[a.id], tf[a.id], tt[a.id]].filter(Boolean).sort();
      return { ...a, last_deposit: dep[a.id] ?? null, last_withdrawal: wd[a.id] ?? null, last_yield: yl[a.id] ?? null, last_activity: dates[dates.length - 1] ?? null };
    });
    return { accounts, cleanupEnabled: s?.value === "true" };
  });

async function deleteAccount(db: any, id: string) {
  for (const [tbl, col] of [["notification_dismissals","user_id"],["notifications","target_user_id"],["daily_yields","user_id"],["deposit_requests","user_id"],["withdrawals","user_id"],["product_orders","user_id"],["package_change_requests","user_id"],["manual_referrals","user_id"],["agent_grants","to_user"],["agent_grants","agent_id"],["transfers","from_user"],["transfers","to_user"],["agent_balances","user_id"],["referral_milestone_claims","user_id"],["user_roles","user_id"]]) {
    await db.from(tbl).delete().eq(col, id);
  }
  await db.from("profiles").update({ referred_by: null }).eq("referred_by", id);
  await db.from("profiles").delete().eq("id", id);
  await db.auth.admin.deleteUser(id);
}

export const deleteAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let n = 0;
    for (const id of data.ids) { if (id === context.userId) continue; await deleteAccount(supabaseAdmin, id); n++; }
    return { deleted: n };
  });

export const cleanupInactiveAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const cutoff = new Date(Date.now() - 40 * 86400000).toISOString();
    const { data: rows } = await db.from("profiles").select("id").eq("is_active", false).is("package_id", null).lt("created_at", cutoff);
    const { data: admins } = await db.from("user_roles").select("user_id").in("role", ["admin", "agent"]);
    const skip = new Set((admins ?? []).map((r: any) => r.user_id));
    let n = 0;
    for (const r of rows ?? []) { if (skip.has(r.id)) continue; await deleteAccount(db, r.id); n++; }
    return { deleted: n };
  });
