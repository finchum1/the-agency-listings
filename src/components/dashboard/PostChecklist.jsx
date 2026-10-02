// Plain-language "how's it looking" readout for the blog post form, shared
// by PostsManager (agent sites) and BrokeragePostsManager (brokerage site).
// Translates things we already track (headings, excerpt, image) into
// everyday language instead of exposing "SEO" jargon to a non-technical
// agent — this is guidance, not a gate, so nothing here blocks saving.
const MIN_WORDS = 150;

function countWords(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
}

export default function PostChecklist({ form }) {
  const wordCount = countWords(form.body_html || "");
  const hasHeading = /<h[23][ >]/i.test(form.body_html || "");

  const items = [
    { label: "Title", done: form.title.trim().length > 0 },
    { label: "Category", done: form.category.trim().length > 0 },
    { label: "Excerpt", done: form.excerpt.trim().length > 0 },
    { label: "Cover photo", done: !!form.image_url },
    { label: "A subheading in the body", done: hasHeading },
    { label: `${MIN_WORDS}+ words (${wordCount} so far)`, done: wordCount >= MIN_WORDS },
  ];

  return (
    <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-3.5">
      <p className="text-xs font-semibold text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-2">How's it looking?</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.label}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              item.done
                ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                : "bg-black/5 dark:bg-white/10 text-[#1c1a17]/50 dark:text-[#faf9f7]/50"
            }`}
          >
            {item.done ? "✓" : "○"} {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
