import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const requestWithdrawal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({
    amount: z.number().finite().min(49),
    wallet: z.string().trim().min(20).max(200),
    network: z.enum(['TRON', 'BNB', 'ETHEREUM', 'SOLANA']),
    currency: z.enum(['USDT', 'USDC', 'BNB', 'ETH', 'SOL', 'TRX']).default('USDT'),
    feeTx: z.string().trim().max(200).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: request, error } = await (context.supabase as any).rpc('request_withdrawal_v2', { _amount: data.amount, _wallet: data.wallet, _network: data.network, _currency: data.currency, _fee_tx: data.feeTx ?? '' });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, request };
  });
