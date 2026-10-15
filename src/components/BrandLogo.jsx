// An organization's logo, or its name when no logo has been uploaded yet, so a header never shows a broken image.
// Colors inherit from the surrounding header/footer, which already sets them per theme.
// `darkSrc`: an optional second logo shown instead in dark mode (for a dark logo that would vanish on a dark menu).
export default function BrandLogo({ src, darkSrc, name, className = "" }) {
  if (src && darkSrc && darkSrc !== src) {
    return (
      <>
        <img src={src} alt={name} className={`${className} dark:hidden`} />
        <img src={darkSrc} alt={name} className={`${className} hidden dark:block`} />
      </>
    );
  }
  if (src) return <img src={src} alt={name} className={className} />;
  return <span className="font-display text-xl sm:text-2xl font-semibold tracking-tight whitespace-nowrap truncate min-w-0" title={name}>
      {name}
    </span>;
}
