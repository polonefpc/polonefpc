import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const POS_KEY = "polone_support_pos";

export function SupportButton() {
  const [url, setUrl] = useState<string>("");
  const [enabled, setEnabled] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const movedRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    supabase.from("settings").select("key,value").in("key", ["support_url", "support_enabled"]).then(({ data }) => {
      const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
      setUrl(map.support_url ?? "");
      setEnabled((map.support_enabled ?? "false") === "true");
    });
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) setPos(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (pos) return;
    // Default to bottom-right after mount so we know window dims.
    setPos({ x: Math.max(12, window.innerWidth - 68), y: Math.max(12, window.innerHeight - 180) });
  }, [pos]);

  const onDown = (e: React.PointerEvent) => {
    if (!pos) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    movedRef.current = false;
    offsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const nx = Math.min(Math.max(4, e.clientX - offsetRef.current.x), window.innerWidth - 56);
    const ny = Math.min(Math.max(4, e.clientY - offsetRef.current.y), window.innerHeight - 56);
    if (Math.abs(nx - (pos?.x ?? 0)) + Math.abs(ny - (pos?.y ?? 0)) > 3) movedRef.current = true;
    setPos({ x: nx, y: ny });
  };
  const onUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    if (pos) try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
    if (!movedRef.current && url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  if (!enabled || !url || !pos) return null;

  return (
    <button
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
      className="fixed z-[9998] w-14 h-14 rounded-full grid place-items-center bg-primary text-primary-foreground shadow-2xl active:scale-95 transition"
      title="الدعم"
      aria-label="الدعم"
    >
      <MessageCircle className="w-6 h-6" />
    </button>
  );
}
