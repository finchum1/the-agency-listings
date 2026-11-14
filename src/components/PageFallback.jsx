// Shown while a page's code is on its way. It waits a moment before appearing so a fast load never flashes it.
export default function PageFallback({ inline = false }) {
  return (
    <div className={`flex items-center justify-center ${inline ? "py-24" : "min-h-screen"}`} style={{ animation: "page-fallback-in 0.2s ease 0.35s both" }}>
      <div className="h-6 w-6 rounded-full border-2 border-black/10 border-t-black/40 animate-spin" role="status" aria-label="Loading" />
    </div>
  );
}
