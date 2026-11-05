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
    const sb = context.supabase as any;
    const [tin, tout, wd, dep, logs] = await Promise.all([
      sb.from('transfers').select('id,amount,created_at,from_user').eq('to_user', data.userId).order('created_at', { ascending: false }).limit(200),
      sb.from('transfers').select('id,amount,created_at,to_user').eq('from_user', data.userId).order('created_at', { ascending: false }).limit(200),
      sb.from('withdrawals').select('id,amount,status,network,currency,fee_amount,fee_status,created_at').eq('user_id', data.userId).order('created_at', { ascending: false }).limit(200),
      sb.from('deposit_requests').select('id,amount,status,tx_hash,created_at').eq('user_id', data.userId).order('created_at', { ascending: false }).limit(200),
      sb.from('earning_logs').select('id,source,amount,note,created_at').eq('user_id', data.userId).order('created_at', { ascending: false }).limit(300),
    ]);
    const ids = [...new Set([...(tin.data ?? []).map((t: any) => t.from_user), ...(tout.data ?? []).map((t: any) => t.to_user)])];
    const names: Record<string, string> = {};
    if (ids.length) { const { data: ps } = await sb.from('profiles').select('id,full_name,referral_code').in('id', ids); for (const x of ps ?? []) names[x.id] = `${x.full_name || 'عميل'} #${x.referral_code}`; }
    const transfers = [
      ...(tin.data ?? []).map((t: any) => ({ id: t.id, dir: 'in' as const, amount: Number(t.amount), at: t.created_at as string, other: names[t.from_user] ?? '—' })),
      ...(tout.data ?? []).map((t: any) => ({ id: t.id, dir: 'out' as const, amount: Number(t.amount), at: t.created_at as string, other: names[t.to_user] ?? '—' })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    return { profile, yields, referrals: [...(referrals.data ?? []), ...(manual.data ?? [])], transfers, withdrawals: (wd.data ?? []) as any[], deposits: (dep.data ?? []) as any[], logs: (logs.data ?? []) as any[] };
  });