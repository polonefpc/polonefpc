import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const transferSchema = z.object({
  toCode: z.string().regex(/^\d{5}$/),
  amount: z.number().positive(),
});

const packageSchema = z.object({
  packageId: z.number().int().positive(),
});

function friendlyError(message: string) {
  if (message.includes("receiver_not_found")) return "المستلم غير موجود";
  if (message.includes("receiver_not_active")) return "حساب المستلم غير مفعّل";
  if (message.includes("sender_not_active")) return "حسابك غير مفعّل — فعّل باقتك أولاً";
  if (message.includes("self_transfer_not_allowed")) return "لا يمكن التحويل لنفس الحساب";
  if (message.includes("insufficient_balance")) return "الرصيد غير كافٍ";
  if (message.includes("invalid_amount")) return "المبلغ غير صحيح";
  if (message.includes("invalid_account_id")) return "معرّف الحساب يجب أن يكون 5 أرقام";
  if (message.includes("package_already_active")) return "لديك باقة مفعّلة بالفعل";
  if (message.includes("package_request_pending")) return "لديك طلب باقة قيد المراجعة";
  if (message.includes("package_not_found")) return "الباقة غير موجودة";
  return "حدث خطأ، حاول مرة أخرى";
}

export const transferPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => transferSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("process_transfer_points", {
      _from_user: context.userId,
      _to_code: data.toCode,
      _amount: data.amount,
    });

    if (error) return { ok: false, error: friendlyError(error.message) };
    return { ok: true, error: null };
  });

export const requestPackagePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => packageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("request_package_purchase", {
      _user_id: context.userId,
      _package_id: data.packageId,
    });

    if (error) return { ok: false, error: friendlyError(error.message) };
    return { ok: true, error: null };
  });