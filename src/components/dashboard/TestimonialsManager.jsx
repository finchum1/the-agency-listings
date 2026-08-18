import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import RichTextEditor from "./RichTextEditor";
import { sanitizeHtml } from "../../lib/sanitizeHtml";

// Plain-text emptiness check for HTML content — good enough to gate the
// submit button (an editor with only an empty <p></p> shouldn't count as
// "has a quote"), not used for anything that touches storage or display.
const isBlankHtml = (html) => !html || !html.replace(/<[^>]*>/g, "").trim();

export default function TestimonialsManager({ agentSiteId, testimonials, onChanged }) {
  const [form, setForm] = useState({ quote: "", author: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputClass =
    "w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40";

  const handleAdd = async (e) => {
    e.preventDefault();
    if (isBlankHtml(form.quote) || !form.author.trim()) return;
    setSaving(true);
    setError("");
    const { error } = await supabase.from("agent_site_testimonials").insert({
      agent_site_id: agentSiteId,
      quote: form.quote,
      author: form.author.trim(),
      sort_order: testimonials.length,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ quote: "", author: "" });
    onChanged?.();
  };

  const move = async (t, direction) => {
    const idx = testimonials.findIndex((x) => x.id === t.id);
    const swapWith = testimonials[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      supabase.from("agent_site_testimonials").update({ sort_order: swapWith.sort_order }).eq("id", t.id),
      supabase.from("agent_site_testimonials").update({ sort_order: t.sort_order }).eq("id", swapWith.id),
    ]);
    onChanged?.();
  };

  const remove = async (t) => {
    if (!confirm("Delete this testimonial?")) return;
    await supabase.from("agent_site_testimonials").delete().eq("id", t.id);
    onChanged?.();
  };

  return (
    <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
      <h2 className="font-display text-lg font-semibold">Testimonials</h2>

      {testimonials.length === 0 ? (
        <p className="text-sm text-[#1c1a17]/40">No testimonials yet.</p>
      ) : (
        <div className="space-y-3">
          {testimonials.map((t, i) => (
            <div key={t.id} className="border border-black/10 rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-[#1c1a17]/80 italic">
                  “
                  <div
                    className="rich-text inline [&>*]:inline"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.quote) }}
                  />
                  ”
                </div>
                <p className="text-xs text-[#1c1a17]/50 mt-1">— {t.author}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs">
                <button
                  type="button"
                  onClick={() => move(t, -1)}
                  disabled={i === 0}
                  className="text-[#1c1a17]/40 hover:text-[#1c1a17] disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(t, 1)}
                  disabled={i === testimonials.length - 1}
                  className="text-[#1c1a17]/40 hover:text-[#1c1a17] disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(t)}
                  className="text-[#1c1a17]/40 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-2 pt-2 border-t border-black/5">
        <RichTextEditor
          value={form.quote}
          onChange={(html) => setForm((f) => ({ ...f, quote: html }))}
          placeholder="Quote"
          minHeight="4rem"
        />
        <div className="flex gap-2">
          <input
            value={form.author}
            onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
            className={inputClass}
            placeholder="Client name"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            + Add
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
