// An organization's logo, or its name when no logo has been uploaded yet, so a header never shows a broken image.
// Colors inherit from the surrounding header/footer, which already sets them per theme.
export default function BrandLogo({ src, name, className = "" }) {
  if (src) return <img src={src} alt={name} className={className} />;
  return <span className="font-display text-xl sm:text-2xl font-semibold tracking-tight whitespace-nowrap">{name}</span>;
}
