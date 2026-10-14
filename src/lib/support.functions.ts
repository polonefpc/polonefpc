import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const supportCustomer = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (error || !admin) throw new Error('غير مصرح');
    const { data: profile, error: profileError } = await context.supabase.from('profiles').select('*,packages(name)').eq('id', data.userId).single();
    if (profileError) throw new Error('تعذر تحميل معلومات الحساب');
    const yields = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: rows, error: readError } = await context.supabase.from('daily_yields').select('id,amount,applied_on,created_at').eq('user_id', data.userId).order('applied_on', { ascending: false }).order('id').range(offset, offset + 999);
      if (readError) throw new Error('تعذر تحميل سجل الأرباح');
      yields.push(...(rows ?? []));
      if (!rows || rows.length < 1000) break;
    }
    const [referrals, manual] = await Promise.all([
      context.supabase.from('profiles').select('id,full_name,referral_code,is_active').eq('referred_by', data.userId),
      context.supabase.from('manual_referrals').select('id,full_name,is_active').eq('user_id', data.userId),
    ]);
    if (referrals.error || manual.error) throw new Error('تعذر تحميل الإحالات');
    return { profile, yields, referrals: [...(referrals.data ?? []), ...(manual.data ?? [])] };
  });