// The small "Featured" tag on a pinned post's photo, shown on the blog page only. The photo wrapper it sits in must be `relative`.
export default function FeaturedTag() {
  return <span className="absolute top-2 left-2 z-10 bg-[var(--as-dark)] text-[var(--as-on-dark)] text-[10px] font-medium tracked-wide uppercase px-2.5 py-1">Featured</span>;
}
