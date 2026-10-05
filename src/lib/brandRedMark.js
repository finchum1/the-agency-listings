import { Mark, mergeAttributes } from "@tiptap/core";

// "The Agency red" text. Stored as <span class="brand-red"> — one fixed
// brand color, not an arbitrary color picker — so the public render
// (lib/sanitizeHtml.js) only has to allow that single class.
//
// Also the paste rule: text copied out of Word (or Google Docs, email,
// a web page…) arrives as <span style="color:#C00000"> / <font color=red>.
// Anything that reads as red becomes brand red; every other color is
// dropped, same as before.

const NAMED = { red: [255, 0, 0], darkred: [139, 0, 0], crimson: [220, 20, 60], firebrick: [178, 34, 34] };

function toRgb(value) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (NAMED[v]) return NAMED[v];
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return m[1].split("").map((h) => parseInt(h + h, 16));
  m = v.match(/^#([0-9a-f]{6})$/);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

// Red-ish, not orange or pink: a strong red channel well above both green
// and blue. Covers Word's "Red" (#FF0000) and "Dark Red" (#C00000).
export function isRedColor(value) {
  const rgb = toRgb(value);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return r >= 120 && g <= 100 && b <= 100 && r - Math.max(g, b) >= 80;
}

export const BrandRed = Mark.create({
  name: "brandRed",

  parseHTML() {
    return [
      { tag: "span.brand-red" },
      { tag: "span", getAttrs: (node) => (isRedColor(node.style?.color) ? {} : false) },
      { tag: "font", getAttrs: (node) => (isRedColor(node.getAttribute("color")) ? {} : false) },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "brand-red" }), 0];
  },

  addCommands() {
    return {
      toggleBrandRed:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});
