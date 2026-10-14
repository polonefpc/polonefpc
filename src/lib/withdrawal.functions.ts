import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const requestWithdrawal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ amount: z.number().finite().min(49), wallet: z.string().trim().min(20).max(200), network: z.enum(['TRON', 'BNB', 'ETHEREUM', 'SOLANA']) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: request, error } = await context.supabase.rpc('request_network_withdrawal', { _amount: data.amount, _wallet: data.wallet, _network: data.network });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, request };
  });