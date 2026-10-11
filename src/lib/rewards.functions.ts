import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Prize = { id: string; label: string; amount: number; weight: number };
export type RewardRound = { id: string; is_open: boolean; created_at: string; prizes: Prize[] };
export type Task = { id: string; title: string; description: string; share_url: string; reward: number; is_active: boolean };
export type Submission = { id: string; task_id: string; user_id: string; links: string[]; proof_image?: string; reward: number; status: string; admin_note: string; created_at: string };
export type Spin = { id: string; round_id: string; user_id: string; prize_id: string; label: string; amount: number; created_at: string };
const uuid = z.string().uuid();
const amount = z.coerce.number().finite().min(0).max(1000000);

export const getRewards = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = context.supabase;
  const results = await Promise.all([
    db.from("settings").select("value").eq("key", "wheel_visible").maybeSingle(),
    db.from("wheel_rounds").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("wheel_spins").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(30),
    db.from("publication_tasks").select("*").eq("is_active", true).order("created_at", { ascending: false }),
    db.from("task_submissions").select("id,task_id,user_id,links,reward,status,admin_note,created_at").eq("user_id", context.userId),
    db.from("profiles").select("is_active").eq("id", context.userId).single(),
  ]);
  for (const result of results) if (result.error) throw new Error(result.error.message);
  return { visible: results[0].data?.value === "true", round: results[1].data as unknown as RewardRound | null, spins: results[2].data as Spin[], tasks: results[3].data as Task[], submissions: results[4].data as Submission[], active: results[5].data?.is_active === true };
});

export const spinWheel = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ roundId: uuid })).handler(async ({ context, data }) => {
  const result = await context.supabase.rpc("spin_reward_wheel", { _round_id: data.roundId });
  if (result.error) throw new Error(result.error.message);
  return result.data as unknown as Spin;
});
export const submitTask = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ taskId: uuid, links: z.array(z.string().url().max(2048).regex(/^https?:\/\//)).min(1).max(10), proof: z.string().max(1100000).regex(/^data:image\/jpeg;base64,/) })).handler(async ({ context, data }) => {
  const result = await context.supabase.rpc("submit_publication_task", { _task_id: data.taskId, _links: data.links, _proof_image: data.proof });
  if (result.error) throw new Error(result.error.message);
  return { id: result.data };
});
export const getRewardsAdmin = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (role.error || !role.data) throw new Error("غير مصرح");
  const db = context.supabase;
  const results = await Promise.all([
    db.from("wheel_prizes").select("*").order("sort_order"),
    db.from("wheel_rounds").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("wheel_assignments").select("*"),
    db.from("wheel_spins").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("publication_tasks").select("*").order("created_at", { ascending: false }),
    db.from("task_submissions").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("profiles").select("id,full_name,referral_code,is_active").order("created_at", { ascending: false }),
    db.from("settings").select("value").eq("key", "wheel_visible").maybeSingle(),
  ]);
  for (const result of results) if (result.error) throw new Error(result.error.message);
  return { prizes: results[0].data as (Prize & { is_active: boolean; sort_order: number })[], round: results[1].data as unknown as RewardRound | null, assignments: results[2].data ?? [], spins: results[3].data as Spin[], tasks: results[4].data as Task[], submissions: results[5].data as Submission[], users: results[6].data ?? [], visible: results[7].data?.value === "true" };
});
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prize"), id: uuid.optional(), label: z.string().trim().min(1).max(80), amount, weight: z.coerce.number().min(0).max(100), is_active: z.boolean(), sort_order: z.number().int() }),
  z.object({ action: z.literal("deletePrize"), id: uuid }),
  z.object({ action: z.literal("visible"), value: z.boolean() }),
  z.object({ action: z.literal("open") }),
  z.object({ action: z.literal("close"), id: uuid }),
  z.object({ action: z.literal("assign"), roundId: uuid, userId: uuid, prizeId: uuid }),
  z.object({ action: z.literal("task"), id: uuid.optional(), title: z.string().trim().min(1).max(120), description: z.string().max(4000), share_url: z.string().url().regex(/^https?:\/\//), reward: amount, is_active: z.boolean() }),
  z.object({ action: z.literal("review"), id: uuid, approve: z.boolean(), note: z.string().max(1000) }),
]);
export const manageRewards = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(actionSchema).handler(async ({ context, data }) => {
  const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (role.error || !role.data) throw new Error("غير مصرح");
  const db = context.supabase;
  let error;
  switch (data.action) {
    case "prize": { const { action: _, id, ...values } = data; const r = id ? await db.from("wheel_prizes").update(values).eq("id", id) : await db.from("wheel_prizes").insert(values); error = r.error; break; }
    case "deletePrize": error = (await db.from("wheel_prizes").delete().eq("id", data.id)).error; break;
    case "visible": error = (await db.from("settings").upsert({ key: "wheel_visible", value: String(data.value) })).error; break;
    case "open": error = (await db.rpc("open_wheel_round")).error; break;
    case "close": { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); error = (await supabaseAdmin.from("wheel_rounds").update({ is_open: false }).eq("id", data.id)).error; break; }
    case "assign": error = (await db.rpc("assign_wheel_prize", { _round_id: data.roundId, _user_id: data.userId, _prize_id: data.prizeId })).error; break;
    case "task": { const { action: _, id, ...values } = data; const r = id ? await db.from("publication_tasks").update(values).eq("id", id) : await db.from("publication_tasks").insert(values); error = r.error; break; }
    case "review": error = (await db.rpc("review_publication_task", { _submission_id: data.id, _approve: data.approve, _note: data.note })).error; break;
  }
  if (error) throw new Error(error.message);
  return { ok: true };
});