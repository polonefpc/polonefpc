import { z } from "zod";

export const promoteAgentSchema = z.object({
  account: z.string().trim().min(1).max(320),
});

export const updateAgentBalanceSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().nonnegative(),
  mode: z.enum(["set", "add"]),
});

export const revokeAgentSchema = z.object({
  userId: z.string().uuid(),
});