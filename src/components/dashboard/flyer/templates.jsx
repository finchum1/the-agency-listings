import ClassicSheet from "./ClassicSheet";
import EditorialSheet from "./EditorialSheet";

// The flyer layouts an agent can pick (listings.flyer_template stores the key). To add one: write a sheet component that takes
// the same props as ClassicSheet and add it here.
export const FLYER_TEMPLATES = [
  { key: "classic", label: "Classic", hint: "Full-width hero photo with the headline over it, stats card, photo row.", Sheet: ClassicSheet },
  { key: "editorial", label: "Minimal editorial", hint: "White space, a large serif address, one clean hero photo and a photo column.", Sheet: EditorialSheet },
];

export function FlyerSheet({ template, ...props }) {
  const { Sheet } = FLYER_TEMPLATES.find((t) => t.key === template) || FLYER_TEMPLATES[0];
  return <Sheet {...props} />;
}
