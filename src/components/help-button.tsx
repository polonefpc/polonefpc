import { useEffect, useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Section = { id: string; title: string; description: string; video_url: string | null };

function toEmbed(url: string): string {
  // YouTube watch / short → embed
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return url;
}

function isIframeable(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com|player\./i.test(url);
}

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("help_sections" as any)
      .select("id,title,description,video_url")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setSections((data as any) ?? []));
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass rounded-full p-2 inline-flex items-center justify-center"
        title="المساعدة"
        aria-label="المساعدة"
      >
        <HelpCircle className="w-4 h-4 text-primary" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 grid place-items-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold">مركز المساعدة</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground text-sm">إغلاق</button>
            </div>
            {sections.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">لا توجد أقسام مساعدة بعد</div>
            )}
            <div className="space-y-2">
              {sections.map((s) => {
                const isOpen = openId === s.id;
                return (
                  <div key={s.id} className="bg-secondary/40 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setOpenId(isOpen ? null : s.id)}
                      className="w-full flex items-center justify-between px-4 py-3 font-bold text-sm text-right"
                    >
                      <span>{s.title}</span>
                      <ChevronDown className={`w-4 h-4 transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 space-y-3">
                        {s.description && (
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{s.description}</p>
                        )}
                        {s.video_url && (
                          isIframeable(s.video_url) ? (
                            <div className="aspect-video rounded-lg overflow-hidden bg-black">
                              <iframe
                                src={toEmbed(s.video_url)}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          ) : (
                            <video src={s.video_url} controls className="w-full rounded-lg bg-black" />
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
