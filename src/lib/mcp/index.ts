import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProfile from "./tools/get-profile";
import listDailyYields from "./tools/list-daily-yields";
import listTransactions from "./tools/list-transactions";

// The OAuth issuer MUST be the direct Supabase host (see cloud-auth-oauth-server).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "polone-mcp",
  title: "Polone",
  version: "0.1.0",
  instructions:
    "Tools for the Polone trading platform. Use these to inspect the signed-in user's profile, daily yield history, and transactions (deposits, withdrawals, transfers).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfile, listDailyYields, listTransactions],
});
