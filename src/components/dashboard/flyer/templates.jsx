import ClassicSheet from "./ClassicSheet";
import EditorialSheet from "./EditorialSheet";
import LuxurySheet from "./LuxurySheet";

// The flyer layouts an agent can pick (listings.flyer_template stores the key). To add one: write a sheet component that takes
// the same props as ClassicSheet and add it here. The sheet marks the area that grows with the text with data-flyer-body (the
// stretched region) and data-flyer-grow (the element whose last child is the lowest text); lineChars / lineHeight (px) turn spare
// or missing space into "about this many characters" for the fit check in FlyerPage.
export const FLYER_TEMPLATES = [
  { key: "classic", label: "Classic", hint: "Full-width hero photo with the headline over it, stats card, photo row.", Sheet: ClassicSheet, lineChars: 105, lineHeight: 21 },
  { key: "editorial", label: "Minimal editorial", hint: "White space, a large serif address, one clean hero photo and a photo column.", Sheet: EditorialSheet, lineChars: 46, lineHeight: 24 },
  { key: "luxury", label: "Luxury dark", hint: "Near-black page, cinematic hero photo, white serif type with a touch of brand red.", Sheet: LuxurySheet, lineChars: 100, lineHeight: 23 },
];

export function FlyerSheet({ template, ...props }) {
  const { Sheet } = FLYER_TEMPLATES.find((t) => t.key === template) || FLYER_TEMPLATES[0];
  return <Sheet {...props} />;
}
