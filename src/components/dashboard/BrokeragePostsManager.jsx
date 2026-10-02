import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ImageUploadField from "./ImageUploadField";
import RichTextEditor from "./RichTextEditor";
import PostChecklist from "./PostChecklist";
import PostCalendar from "./PostCalendar";
import PostAnalytics from "./PostAnalytics";
import { usePostViewCounts } from "../../hooks/usePostViewCounts";

const emptyForm = {
  slug: "",
  title: "",
  category: "",
  post_date: new Date().toISOString().slice(0, 10),
  excerpt: "",
  image_url: "",
  body_html: "",
  status: "draft",
  scheduled_at: "",
};

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// datetime-local inputs want "YYYY-MM-DDTHH:mm" in the browser's own local
// time — new Date(isoString) already converts to local for us, so this
// just pads it into that exact shape.
function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatScheduled(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Posts arrive newest-first (useBrokerageSiteEditor orders by post_date
// desc) — show the most recent handful and collapse the rest behind a
// toggle rather than stacking every post ever written.
const COLLAPSED_COUNT = 4;

// Preset categories instead of a blank free-text field — see PostsManager.jsx
// for the same pattern on agent sites. "Other" drops back to free text.
const CATEGORIES = ["Market Update", "Neighborhood Guide", "New Listing Spotlight", "Buyer Tips", "Seller Tips", "Just Sold"];

// Blog CRUD for the brokerage site — parallel to PostsManager.jsx (agent
// sites), targeting brokerage_posts instead of agent_site_posts. No
// agent_site_id/related_listing_id: these posts are brokerage-wide, not
// tied to one agent or their listings.
export default function BrokeragePostsManager({ brokerageSiteId, posts, onChanged }) {
  const [editingId, setEditingId] = useState(null); // null closed, "new" adding
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showSlugField, setShowSlugField] = useState(false);
  const [useOtherCategory, setUseOtherCategory] = useState(false);
  const [view, setView] = useState("list");
  const viewCounts = usePostViewCounts("brokerage_post", posts.map((p) => p.id));

  const inputClass =
    "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";

  const startAdd = () => {
    setForm(emptyForm);
    setShowSlugField(false);
    setUseOtherCategory(false);
    setEditingId("new");
  };

  const startEdit = (post) => {
    setForm({
      slug: post.slug,
      title: post.title,
      category: post.category || "",
      post_date: post.post_date,
      excerpt: post.excerpt || "",
      image_url: post.image_url || "",
      body_html: post.body_html || "",
      status: post.status,
      scheduled_at: toDatetimeLocalValue(post.scheduled_at),
    });
    setShowSlugField(false);
    setUseOtherCategory(!!post.category && !CATEGORIES.includes(post.category));
    setEditingId(post.id);
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowSlugField(false);
    setUseOtherCategory(false);
    setError("");
  };

  const startAddOnDate = (dateKey) => {
    setForm({ ...emptyForm, post_date: dateKey });
    setShowSlugField(false);
    setUseOtherCategory(false);
    setEditingId("new");
  };

  const update = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => ({
      ...f,
      [field]: value,
      ...(field === "title" && editingId === "new" ? { slug: slugify(value) } : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.slug.trim()) return;
    setSaving(true);
    setError("");

    const payload = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      category: form.category,
      post_date: form.post_date,
      excerpt: form.excerpt,
      image_url: form.image_url || null,
      body_html: form.body_html,
      status: form.status,
      scheduled_at: form.status === "scheduled" && form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
    };

    const { error } =
      editingId === "new"
        ? await supabase.from("brokerage_posts").insert(payload)
        : await supabase.from("brokerage_posts").update(payload).eq("id", editingId);

    setSaving(false);
    if (error) {
      setError(error.code === "23505" ? "That slug is already used by another post." : error.message);
      return;
    }
    cancel();
    onChanged?.();
  };

  const remove = async (post) => {
    if (!confirm(`Delete "${post.title}"?`)) return;
    await supabase.from("brokerage_posts").delete().eq("id", post.id);
    onChanged?.();
  };

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Blog Posts</h2>
        {editingId === null && (
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-full border border-black/10 dark:border-white/15 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`px-2.5 py-1 rounded-full transition-colors ${
                  view === "list" ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "text-[#1c1a17]/60 dark:text-[#faf9f7]/60"
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className={`px-2.5 py-1 rounded-full transition-colors ${
                  view === "calendar" ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "text-[#1c1a17]/60 dark:text-[#faf9f7]/60"
                }`}
              >
                Calendar
              </button>
            </div>
            <button
              type="button"
              onClick={() => setView(view === "analytics" ? "list" : "analytics")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                view === "analytics"
                  ? "bg-[#1c1a17] dark:bg-[#f2454b] border-transparent text-white"
                  : "border-black/10 dark:border-white/15 text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
              }`}
            >
              Analytics
            </button>
            <button type="button" onClick={startAdd} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
              + Add post
            </button>
          </div>
        )}
      </div>

      {editingId !== null && (
        <form onSubmit={handleSubmit} className="space-y-3 pb-3 border-b border-black/5 dark:border-white/10">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Title</label>
              <input required value={form.title} onChange={update("title")} className={inputClass} />
            </div>
            <div>
              {showSlugField ? (
                <>
                  <label className={labelClass}>URL slug</label>
                  <input required value={form.slug} onChange={update("slug")} className={inputClass} />
                </>
              ) : (
                <>
                  <label className={labelClass}>Web address</label>
                  <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50 px-1 py-2.5">
                    <span className="font-mono">/blog/{form.slug || "…"}</span>{" "}
                    <button
                      type="button"
                      onClick={() => setShowSlugField(true)}
                      className="text-[#ed2127] dark:text-[#f2454b] hover:underline font-medium"
                    >
                      Customize
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={useOtherCategory ? "Other" : form.category}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "Other") {
                    setUseOtherCategory(true);
                    setForm((f) => ({ ...f, category: CATEGORIES.includes(f.category) ? "" : f.category }));
                  } else {
                    setUseOtherCategory(false);
                    setForm((f) => ({ ...f, category: v }));
                  }
                }}
                className={inputClass}
              >
                <option value="" disabled>
                  Choose…
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="Other">Other…</option>
              </select>
              {useOtherCategory && (
                <input
                  value={form.category}
                  onChange={update("category")}
                  placeholder="Custom category"
                  className={`${inputClass} mt-2`}
                />
              )}
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={form.post_date} onChange={update("post_date")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.status} onChange={update("status")} className={inputClass}>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          {form.status === "scheduled" && (
            <div>
              <label className={labelClass}>Publish at</label>
              <input
                type="datetime-local"
                required
                value={form.scheduled_at}
                onChange={update("scheduled_at")}
                className={inputClass}
              />
              <p className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mt-1">
                Goes live on the site automatically at this date and time.
              </p>
            </div>
          )}
          <div>
            <label className={labelClass}>Excerpt</label>
            <textarea value={form.excerpt} onChange={update("excerpt")} rows={2} className={inputClass} />
          </div>
          <ImageUploadField
            bucket="brokerage-site-photos"
            folder={brokerageSiteId}
            value={form.image_url}
            onChange={(url) => setForm((f) => ({ ...f, image_url: url || "" }))}
          />
          <div>
            <label className={labelClass}>Body</label>
            <RichTextEditor
              value={form.body_html}
              onChange={(html) => setForm((f) => ({ ...f, body_html: html }))}
              placeholder="Write the post…"
              minHeight="14rem"
            />
          </div>
          <PostChecklist form={form} />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId === "new" ? "Add Post" : "Save Changes"}
            </button>
            <button type="button" onClick={cancel} className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
              Cancel
            </button>
          </div>
        </form>
      )}

      {posts.length === 0 && editingId === null && <p className="text-sm text-[#1c1a17]/40 dark:text-[#faf9f7]/40">No posts yet.</p>}

      {editingId === null && view === "calendar" && posts.length > 0 && (
        <PostCalendar posts={posts} onEdit={startEdit} onAddDate={startAddOnDate} viewCounts={viewCounts} />
      )}

      {editingId === null && view === "analytics" && posts.length > 0 && (
        <PostAnalytics posts={posts} viewCounts={viewCounts} onEdit={startEdit} />
      )}

      {editingId === null && view === "list" && posts.length > 0 && (
        <div className="space-y-2">
          {(showAll ? posts : posts.slice(0, COLLAPSED_COUNT)).map((post) => {
            const isDue = post.status === "scheduled" && post.scheduled_at && new Date(post.scheduled_at) <= new Date();
            const isLive = post.status === "published" || isDue;
            return (
            <div key={post.id} className="border border-black/10 dark:border-white/15 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{post.title}</p>
                <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
                  {post.category} · {post.post_date} ·{" "}
                  <span
                    className={
                      isLive
                        ? "text-emerald-700 dark:text-emerald-400"
                        : post.status === "scheduled"
                          ? "text-amber-700 dark:text-amber-400"
                          : ""
                    }
                  >
                    {isLive
                      ? "Published"
                      : post.status === "scheduled"
                        ? `Scheduled · ${formatScheduled(post.scheduled_at)}`
                        : "Draft"}
                  </span>
                  {isLive && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="font-medium text-[#1c1a17]/80 dark:text-[#faf9f7]/80">
                        {(viewCounts[post.id]?.total || 0).toLocaleString()} all-time view{(viewCounts[post.id]?.total || 0) === 1 ? "" : "s"}
                      </span>{" "}
                      · {(viewCounts[post.id]?.last30 || 0).toLocaleString()} in last 30 days
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                <button onClick={() => startEdit(post)} className="text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">Edit</button>
                <button onClick={() => remove(post)} className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-red-600 dark:hover:text-red-400">✕</button>
              </div>
            </div>
            );
          })}
          {posts.length > COLLAPSED_COUNT && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full text-center text-xs font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] pt-1"
            >
              {showAll ? "Show fewer posts" : `Show ${posts.length - COLLAPSED_COUNT} more post${posts.length - COLLAPSED_COUNT === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
