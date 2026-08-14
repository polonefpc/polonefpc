import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  promoteAgentSchema,
  revokeAgentSchema,
  updateAgentBalanceSchema,
} from "@/lib/agent-admin.schemas";

export const promoteAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => promoteAgentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) return { ok: false, error: "غير مصرح" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const account = data.account.trim();
    let query = supabaseAdmin.from("profiles").select("id,email,referral_code");
    query = /^[0-9a-f-]{36}$/i.test(account)
      ? query.eq("id", account)
      : account.includes("@")
        ? query.eq("email", account)
        : query.eq("referral_code", account);
    const { data: profile, error: profileError } = await query.maybeSingle();
    if (profileError) return { ok: false, error: "تعذر البحث عن الحساب" };
    if (!profile) return { ok: false, error: "لم يوجد المستخدم" };

    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: profile.id, role: "agent" }, { onConflict: "user_id,role" });
    if (insertError) return { ok: false, error: "تعذر منح صلاحية التاجر" };

    const { error: balanceError } = await supabaseAdmin
      .from("agent_balances")
      .upsert({ user_id: profile.id, balance: 0 }, { onConflict: "user_id", ignoreDuplicates: true });
    if (balanceError) return { ok: false, error: "تم تعيين التاجر لكن تعذر إنشاء رصيده" };
    return { ok: true, error: null };
  });

export const updateAgentBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateAgentBalanceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false, error: "غير مصرح" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin
      .from("agent_balances")
      .select("balance")
      .eq("user_id", data.userId)
      .maybeSingle();
    const nextBalance = data.mode === "add" ? Number(current?.balance ?? 0) + data.amount : data.amount;
    const { error } = await supabaseAdmin
      .from("agent_balances")
      .upsert({ user_id: data.userId, balance: nextBalance, updated_at: new Date().toISOString() });
    return error ? { ok: false, error: "تعذر تحديث رصيد التاجر" } : { ok: true, error: null };
  });

export const revokeAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => revokeAgentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false, error: "غير مصرح" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "agent");
    return error ? { ok: false, error: "تعذر إلغاء تعيين التاجر" } : { ok: true, error: null };
  });