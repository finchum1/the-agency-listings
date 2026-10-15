import { brandFromOrg } from "../../lib/brand";
import BrandLogo from "../BrandLogo";
import { LatchpointLogomark } from "../marketing/LatchpointMarks";

// The logo above the sign-in and invite screens. Before anyone has signed in there is no way to know whose dashboard
// this is, so on the platform's own hosts it is the platform's mark (Latchpoint). A brokerage's own dashboard domain
// (org is set) wears that brokerage's brand instead. Colors come from the page's theme tokens, so the mark reads on the
// cream background.
export default function AuthBrand({ org, loading = false, className = "" }) {
  // Waiting to learn whose brand this is: hold the space so the page doesn't jump or flash the wrong mark
  if (loading) return <div className={`h-14 ${className}`} aria-hidden="true" />;
  if (org) {
    const brand = brandFromOrg(org);
    return (
      <div className={`flex items-center justify-center gap-3 ${className}`}>
        <BrandLogo src={brand.logo} name={brand.name} className="h-14 w-auto" />
        {brand.locationLabel && (
          <>
            <span className="h-9 w-px bg-black/10" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50">{brand.locationLabel}</span>
          </>
        )}
      </div>
    );
  }
  return (
    // Fixed dark colors, not the theme tokens: the sign-in and invite pages are always light (cream background, white
    // card), so in dark mode the tokens would turn the mark pale and wash it out.
    <div className={`flex items-center justify-center gap-3 font-geist text-[#16171a] ${className}`}>
      <LatchpointLogomark className="size-10" />
      <span className="text-2xl font-medium tracking-tight">
        Latchpoint<span className="text-[#55565e]"> Studios</span>
      </span>
    </div>
  );
}
