import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

// Shared WYSIWYG editor used in every rich-text field across the
// dashboard (Bio, Testimonials, Areas of Expertise, Blog posts) — one
// component, one toolbar, so formatting behaves identically everywhere
// an agent edits content that ends up on their public site. Stores/emits
// plain HTML strings; the public-facing components render that HTML
// through lib/sanitizeHtml.js, never trusting it as-is.
//
// Deliberately narrow: paragraph, one heading level (h3 — matches the
// blog post convention that already existed before this), bold, italic,
// underline. No links, no colors, no multiple heading levels — this is
// short-form marketing copy (a bio, a testimonial, a blog post), not a
// general document editor.
export default function RichTextEditor({ value, onChange, placeholder, minHeight = "8rem" }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        // Keep the tag surface minimal to match ALLOWED_TAGS in
        // lib/sanitizeHtml.js — no blockquote/codeBlock/horizontalRule/
        // lists in this editor's UI, so nothing it can produce needs a
        // toolbar button that isn't there.
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Underline,
      Placeholder.configure({ placeholder: placeholder || "" }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        // No @tailwindcss/typography plugin in this app, and Tailwind's
        // own preflight resets h1-h6 to inherit size/weight — so h3 needs
        // explicit styling here (see the .tiptap rules in index.css) or
        // the Heading button would produce text indistinguishable from a
        // plain paragraph.
        class: "max-w-none focus:outline-none px-3.5 py-2.5 text-sm",
      },
    },
  });

  // Keep the editor in sync when `value` changes from OUTSIDE typing —
  // e.g. switching which testimonial/area is being edited, or the form
  // resetting after save. `false` skips re-emitting onUpdate, and the
  // equality check avoids fighting the user's own cursor position while
  // they're actively typing (which would also trigger this effect via
  // the parent's own state update).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (next !== current) editor.commands.setContent(next, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  const buttonClass = (active) =>
    `h-7 min-w-7 px-1.5 rounded-md text-xs font-semibold transition-colors ${
      active ? "bg-[#ed2127]/10 text-[#ed2127]" : "text-[#1c1a17]/60 hover:bg-black/5"
    }`;

  return (
    <div className="rounded-lg border border-black/10 focus-within:ring-2 focus-within:ring-[#ed2127]/40 overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-black/10 bg-[#faf9f7]">
        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={buttonClass(editor.isActive("paragraph"))}
          title="Paragraph"
        >
          P
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={buttonClass(editor.isActive("heading", { level: 3 }))}
          title="Heading"
        >
          H
        </button>
        <span className="w-px h-5 bg-black/10 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${buttonClass(editor.isActive("bold"))} font-bold`}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${buttonClass(editor.isActive("italic"))} italic`}
          title="Italic"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`${buttonClass(editor.isActive("underline"))} underline`}
          title="Underline"
        >
          U
        </button>
      </div>
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
