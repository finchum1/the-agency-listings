// Floating "Save Changes" pill for the long dashboard forms (SiteForm.jsx,
// BrokerageSiteForm.jsx) — fixed to the bottom of the viewport so it's
// reachable without scrolling all the way down to the form's own trailing
// submit button, which stays in place underneath as a fallback (Enter-key
// submit, screen readers, etc.). Only appears once something's actually
// changed, or right after a save, so it doesn't sit on screen at rest.
export default function FormSaveBar({ dirty, saving, saved, error }) {
  if (!dirty && !saving && !(saved && !dirty) && !error) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white pl-5 pr-2 py-2 shadow-xl shadow-black/20">
      {error ? (
        <span className="text-xs font-medium max-w-xs truncate">{error}</span>
      ) : dirty || saving ? (
        <span className="text-xs font-medium">Unsaved changes</span>
      ) : (
        <span className="text-xs font-medium">Saved</span>
      )}
      {(dirty || saving) && (
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-4 py-2 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      )}
    </div>
  );
}
