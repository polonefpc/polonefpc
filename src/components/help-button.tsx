import { useEffect, useState } from "react";
import { HelpCircle, ChevronDown, X } from "lucide-react";
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
          className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-start justify-center px-3 py-5 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[calc(100dvh-2.5rem)] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-popover px-4 py-3">
              <h3 className="text-lg font-extrabold">مركز المساعدة</h3>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground" aria-label="إغلاق">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto p-4">
              {sections.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">لا توجد أقسام مساعدة بعد</div>
              )}
              <div className="space-y-2">
              {sections.map((s) => {
                const isOpen = openId === s.id;
                return (
                  <div key={s.id} className="overflow-hidden rounded-xl border border-border bg-secondary/40">
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
        </div>
      )}
    </>
  );
}
