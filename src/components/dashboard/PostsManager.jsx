import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ImageUploadField from "./ImageUploadField";

const emptyForm = {
  slug: "",
  title: "",
  category: "",
  post_date: new Date().toISOString().slice(0, 10),
  excerpt: "",
  image_url: "",
  bodyText: "",
  related_listing_id: "",
  status: "draft",
};

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Body textarea convention: blank-line-separated paragraphs; a line
// starting with "### " becomes a subheading. Kept deliberately simple —
// no rich-text editor — mirroring how terrence-finchum-realty's blog
// posts are just an array of {type, text} blocks.
function bodyToText(body) {
  return (body || [])
    .map((block) => (block.type === "h3" ? `### ${block.text}` : block.text))
    .join("\n\n");
}
function textToBody(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith("### ") ? { type: "h3", text: p.slice(4) } : { type: "p", text: p }));
}

export default function PostsManager({ agentSiteId, agentId, posts, onChanged }) {
  const [editingId, setEditingId] = useState(null); // null closed, "new" adding
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [myListings, setMyListings] = useState([]);

  useEffect(() => {
    if (!agentId) return;
    supabase
      .from("listings")
      .select("id, address_line1, city")
      .eq("agent_id", agentId)
      .then(({ data }) => setMyListings(data || []));
  }, [agentId]);

  const inputClass =
    "w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 mb-1.5";

  const startAdd = () => {
    setForm(emptyForm);
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
      bodyText: bodyToText(post.body),
      related_listing_id: post.related_listing_id || "",
      status: post.status,
    });
    setEditingId(post.id);
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
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
      body: textToBody(form.bodyText),
      related_listing_id: form.related_listing_id || null,
      status: form.status,
    };

    const { error } =
      editingId === "new"
        ? await supabase.from("agent_site_posts").insert({ ...payload, agent_site_id: agentSiteId })
        : await supabase.from("agent_site_posts").update(payload).eq("id", editingId);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    cancel();
    onChanged?.();
  };

  const remove = async (post) => {
    if (!confirm(`Delete "${post.title}"?`)) return;
    await supabase.from("agent_site_posts").delete().eq("id", post.id);
    onChanged?.();
  };

  return (
    <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Blog Posts</h2>
        {editingId === null && (
          <button type="button" onClick={startAdd} className="text-xs font-semibold text-[#8a7a5c] hover:underline">
            + Add post
          </button>
        )}
      </div>

      {posts.length === 0 && editingId === null && <p className="text-sm text-[#1c1a17]/40">No posts yet.</p>}

      {posts.length > 0 && (
        <div className="space-y-2">
          {posts.map((post) => (
            <div key={post.id} className="border border-black/10 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{post.title}</p>
                <p className="text-xs text-[#1c1a17]/50">
                  {post.category} · {post.post_date} ·{" "}
                  <span className={post.status === "published" ? "text-emerald-700" : ""}>
                    {post.status === "published" ? "Published" : "Draft"}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                <button onClick={() => startEdit(post)} className="text-[#1c1a17]/60 hover:text-[#1c1a17]">Edit</button>
                <button onClick={() => remove(post)} className="text-[#1c1a17]/40 hover:text-red-600">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingId !== null && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t border-black/5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Title</label>
              <input required value={form.title} onChange={update("title")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <input required value={form.slug} onChange={update("slug")} className={inputClass} />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Category</label>
              <input value={form.category} onChange={update("category")} className={inputClass} placeholder="NEIGHBORHOOD GUIDE" />
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={form.post_date} onChange={update("post_date")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.status} onChange={update("status")} className={inputClass}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Excerpt</label>
            <textarea value={form.excerpt} onChange={update("excerpt")} rows={2} className={inputClass} />
          </div>
          <ImageUploadField
            bucket="agent-site-photos"
            folder={agentSiteId}
            value={form.image_url}
            onChange={(url) => setForm((f) => ({ ...f, image_url: url || "" }))}
          />
          <div>
            <label className={labelClass}>Body</label>
            <textarea
              value={form.bodyText}
              onChange={update("bodyText")}
              rows={10}
              className={inputClass}
              placeholder={"One paragraph per block, separated by a blank line.\nStart a line with \"### \" to make it a subheading."}
            />
          </div>
          {myListings.length > 0 && (
            <div>
              <label className={labelClass}>Related listing (optional)</label>
              <select value={form.related_listing_id} onChange={update("related_listing_id")} className={inputClass}>
                <option value="">None</option>
                {myListings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.address_line1}, {l.city}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId === "new" ? "Add Post" : "Save Changes"}
            </button>
            <button type="button" onClick={cancel} className="text-sm text-[#1c1a17]/50 hover:text-[#1c1a17]">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
