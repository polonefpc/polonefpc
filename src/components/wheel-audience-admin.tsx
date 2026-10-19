import { useState } from "react";
import { Gift, Users, UserPlus, Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { wheelAudienceLabels, type WheelAudience } from "@/lib/wheel-audience";

type User = { id: string; full_name: string | null; referral_code: string; is_active: boolean };
export function WheelAudienceAdmin({ users, onOpen }: { users: User[]; onOpen: (audience: WheelAudience, userIds: string[]) => Promise<boolean> }) {
  const [audience, setAudience] = useState<WheelAudience>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const icons = { all: Users, welcome: Gift, referral: UserPlus, selected: Check };
  const filtered = users.filter(u => u.is_active && `${u.full_name ?? ""} ${u.referral_code}`.includes(query.trim()));
  return <div className="space-y-3 border-t border-border pt-3">
    <h3 className="text-sm font-bold">نوع الجولة الجديدة</h3>
    <div className="grid grid-cols-2 gap-2">{(Object.keys(wheelAudienceLabels) as WheelAudience[]).map(mode => {
      const Icon = icons[mode];
      return <Button key={mode} variant={audience === mode ? "default" : "outline"} aria-pressed={audience === mode} onClick={() => setAudience(mode)} className="h-auto min-h-10 whitespace-normal"><Icon />{wheelAudienceLabels[mode]}</Button>;
    })}</div>
    {audience === "welcome" && <p className="text-xs text-muted-foreground">للحسابات الجديدة المسجلة بعد فتح الجولة، بعد تفعيلها؛ بونص العجلة الترحيبي مرة واحدة للحساب.</p>}
    {audience === "referral" && <p className="text-xs text-muted-foreground">محاولة للمستخدم المفعل عند تسجيل عضو جديد برمز إحالته بعد فتح الجولة؛ محاولة واحدة في الجولة.</p>}
    {audience === "selected" && <div className="space-y-2">
      <input aria-label="بحث حسابات العجلة" placeholder="بحث بالاسم أو رمز الإحالة" className="reward-input" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="max-h-48 overflow-y-auto space-y-2">{filtered.map(u => <label key={u.id} className="flex items-center gap-2 text-sm py-1"><input type="checkbox" checked={selected.includes(u.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, u.id] : ids.filter(id => id !== u.id))} />{u.full_name || "—"} #{u.referral_code}</label>)}</div>
      <span className="text-xs text-muted-foreground">الحسابات المحددة: {selected.length}</span>
    </div>}
    <Button disabled={busy || (audience === "selected" && selected.length === 0)} onClick={async () => {
      setBusy(true);
      try { await onOpen(audience, audience === "selected" ? selected : []); } finally { setBusy(false); }
    }}><Play />{busy ? "جاري فتح الجولة..." : "تشغيل جولة جديدة"}</Button>
  </div>;
}