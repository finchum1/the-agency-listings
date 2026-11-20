// Lays a guide (src/lib/guides.js) out as a branded PDF with @react-pdf/renderer: a cover in the site's colors, the agent's welcome, the sections, and a
// last page with the agent's contact details and the brokerage disclaimer. Pure: it takes the guide, the brand and already-fetched images (PNG buffers)
// and returns a Buffer, so it can be tried without the database (see api/guide-pdf.js for where those come from).
import React from "react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

const h = React.createElement;
const here = path.dirname(fileURLToPath(import.meta.url));
const font = (file) => path.join(here, "guide-fonts", file);
Font.register({ family: "Garamond", fonts: [{ src: font("EBGaramond-Regular.ttf"), fontWeight: 400 }, { src: font("EBGaramond-SemiBold.ttf"), fontWeight: 600 }] });
Font.register({ family: "Inter", fonts: [{ src: font("Inter-Regular.ttf"), fontWeight: 400 }, { src: font("Inter-SemiBold.ttf"), fontWeight: 600 }] });
Font.registerHyphenationCallback((word) => [word]);

const INK = "#1C1C1B";
const MUTED = "#6B665A";
const RULE = "#E4DFD3";
const PAPER = "#F5F1E9";

/** How light a #rrggbb color is, 0 to 1: decides whether text on it should be dark or light. */
export const lightness = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

const styles = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 62, paddingHorizontal: 54, fontFamily: "Inter", fontSize: 10, lineHeight: 1.55, color: INK },
  footer: { position: "absolute", left: 54, right: 54, bottom: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED, borderTopWidth: 0.5, borderTopColor: RULE, borderTopStyle: "solid", paddingTop: 8 },
  h1: { fontFamily: "Garamond", fontWeight: 600, fontSize: 25, lineHeight: 1.15, marginTop: 4 },
  lead: { marginTop: 6, color: MUTED, fontSize: 11 },
  body: { marginTop: 8 },
});

const Eyebrow = ({ children, color }) => h(Text, { style: { fontSize: 8, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 600, color } }, children);

function Block({ block, accent }) {
  if (block.type === "text") return h(Text, { style: styles.body }, block.text);
  if (block.type === "quote") return h(Text, { style: { fontFamily: "Garamond", fontSize: 22, marginTop: 14, color: accent } }, block.text);
  if (block.type === "bullets" || block.type === "checklist") {
    return h(
      View,
      { style: { marginTop: 8 } },
      block.items.map((t, i) =>
        h(
          View,
          { key: i, wrap: false, style: { flexDirection: "row", marginBottom: 5 } },
          block.type === "checklist"
            ? h(View, { style: { width: 9, height: 9, borderWidth: 1, borderColor: accent, borderStyle: "solid", marginRight: 9, marginTop: 2 } })
            : h(View, { style: { width: 4, height: 4, borderRadius: 2, backgroundColor: accent, marginRight: 10, marginTop: 5 } }),
          h(Text, { style: { flex: 1 } }, t),
        ),
      ),
    );
  }
  if (block.type === "steps") {
    return h(
      View,
      { style: { marginTop: 10 } },
      block.items.map((s, i) =>
        h(
          View,
          { key: i, wrap: false, style: { flexDirection: "row", marginBottom: 12 } },
          h(View, { style: { width: 22, height: 22, borderRadius: 11, backgroundColor: accent, alignItems: "center", justifyContent: "center", marginRight: 12 } }, h(Text, { style: { color: "#FFFFFF", fontSize: 10, fontWeight: 600 } }, String(i + 1))),
          h(
            View,
            { style: { flex: 1 } },
            h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: 14, lineHeight: 1.2, marginBottom: 2 } }, s.title),
            s.tag ? h(Text, { style: { fontSize: 8.5, color: accent, fontWeight: 600, letterSpacing: 0.4, marginBottom: 2 } }, s.tag) : null,
            h(Text, { style: { color: "#3b3830" } }, s.body),
          ),
        ),
      ),
    );
  }
  if (block.type === "cards") {
    return h(
      View,
      { style: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" } },
      block.items.map((c, i) =>
        h(
          View,
          { key: i, wrap: false, style: { width: "48.5%", backgroundColor: PAPER, padding: 12, marginBottom: 10, borderLeftWidth: 2.5, borderLeftColor: accent, borderLeftStyle: "solid" } },
          h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: 13, marginBottom: 3 } }, c.title),
          h(Text, { style: { fontSize: 9.2, color: "#3b3830" } }, c.body),
        ),
      ),
    );
  }
  if (block.type === "faq") {
    return h(
      View,
      { style: { marginTop: 8 } },
      block.items.map((f, i) =>
        h(View, { key: i, wrap: false, style: { marginBottom: 12 } }, h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: 13.5 } }, f.q), h(Text, { style: { marginTop: 2, color: "#3b3830" } }, f.a)),
      ),
    );
  }
  return null;
}

/**
 * @param guide   one of GUIDES (src/lib/guides.js)
 * @param agent   { name, first, team, title, license, phone, email, website, members: [{ name, title, license, phone, email }] }. On a team site `name` is the team's and
 *                `members` is everyone on it, the site's owner first; otherwise `members` is just the agent.
 * @param brand   { dark, onDark, accent, org, address, disclaimer, franchiseDisclaimer, location }
 * @param images  { logo, photos }: PNG buffers or null; `photos` lines up with `members`
 * @returns Promise<Buffer>
 */
export async function buildGuidePdf({ guide, agent, brand, images = {} }) {
  const onLight = lightness(brand.dark) > 0.6;
  const title = guide.slug === "relocation" && !/oklahoma/i.test(brand.location || "") ? "Relocating With Me" : guide.title;
  const who = agent.name || brand.org;
  const members = agent.members?.length ? agent.members : [{ name: agent.name, title: agent.title, license: agent.license, phone: agent.phone, email: agent.email }];
  const photos = images.photos || [];
  const solo = members.length === 1;
  const logo = images.logo ? h(Image, { src: { data: images.logo, format: "png" }, style: { height: 46, objectFit: "contain", objectPosition: "left" } }) : h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: 20, color: brand.onDark } }, brand.org);
  const circle = (i, size, overlap = 0) =>
    photos[i]
      ? h(Image, { key: i, src: { data: photos[i], format: "png" }, style: { width: size, height: size, borderRadius: size / 2, objectFit: "cover", marginLeft: i ? overlap : 0, borderWidth: overlap ? 2 : 0, borderColor: brand.dark, borderStyle: "solid" } })
      : null;
  const firsts = members.map((m) => (m.name || "").split(" ")[0]).filter(Boolean);
  const sign = firsts.length > 1 ? `${firsts.slice(0, -1).join(", ")} and ${firsts[firsts.length - 1]}` : firsts[0] || "";
  const contact = [agent.phone, agent.email].filter(Boolean);

  const cover = h(
    Page,
    { size: "LETTER", style: { backgroundColor: brand.dark, color: brand.onDark, padding: 64, fontFamily: "Inter" } },
    h(View, { style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" } }, logo),
    h(
      View,
      { style: { marginTop: 190 } },
      h(Eyebrow, { color: onLight ? brand.accent : brand.onDark }, `A guide from ${who}`),
      h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: 46, lineHeight: 1.05, marginTop: 14, color: brand.onDark } }, title),
      h(View, { style: { width: 56, height: 3, backgroundColor: brand.accent, marginTop: 20, marginBottom: 18 } }),
      h(Text, { style: { fontSize: 14, lineHeight: 1.45, color: brand.onDark, opacity: 0.8, maxWidth: 360 } }, guide.subtitle),
    ),
    h(
      View,
      { style: { position: "absolute", left: 64, right: 64, bottom: 64, flexDirection: "row", alignItems: "center" } },
      photos.some(Boolean) ? h(View, { style: { flexDirection: "row", marginRight: 16 } }, ...members.slice(0, 4).map((_, i) => circle(i, solo ? 64 : 52, solo ? 0 : -14))) : null,
      h(
        View,
        { style: { flex: 1 } },
        h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: 18, lineHeight: 1.2, marginBottom: 3, color: brand.onDark } }, who),
        solo
          ? agent.name && brand.org ? h(Text, { style: { fontSize: 9.5, color: brand.onDark, opacity: 0.75 } }, [agent.title, brand.org].filter(Boolean).join(" · ")) : null
          : h(Text, { style: { fontSize: 9.5, color: brand.onDark, opacity: 0.75 } }, [members.map((m) => m.name).join(", "), brand.org].filter(Boolean).join(" · ")),
        solo && contact.length ? h(Text, { style: { fontSize: 9.5, color: brand.onDark, opacity: 0.75, marginTop: 2 } }, contact.join("   ·   ")) : null,
      ),
    ),
  );

  // Fixed on every page. Each piece is its own absolutely placed element (a row View with fixed children dropped out of the PDF).
  const foot = { position: "absolute", bottom: 30, fontSize: 8, color: MUTED };
  const footer = () => [
    h(View, { key: "rule", fixed: true, style: { position: "absolute", left: 54, right: 54, bottom: 44, height: 0.5, backgroundColor: RULE } }),
    h(Text, { key: "who", fixed: true, style: { ...foot, left: 54 } }, `${title}  ·  ${who}`),
    h(Text, { key: "num", fixed: true, style: { ...foot, left: 54, width: 504, textAlign: "right" }, render: ({ pageNumber }) => `${pageNumber - 1}` }),
  ];

  const content = h(
    Page,
    { size: "LETTER", style: styles.page, wrap: true },
    h(Eyebrow, { color: brand.accent }, "Welcome"),
    h(Text, { style: { ...styles.h1, fontSize: 30 } }, `Let's get you where you want to go.`),
    h(Text, { style: { fontFamily: "Garamond", fontSize: 15, lineHeight: 1.5, marginTop: 14, color: "#3b3830" } }, guide.intro),
    h(Text, { style: { marginTop: 10, color: MUTED } }, sign ? `— ${sign}` : ""),
    ...guide.sections.map((s, i) =>
      h(
        View,
        { key: i, style: { marginTop: 30 } },
        h(View, { wrap: false, minPresenceAhead: 150 }, h(Eyebrow, { color: brand.accent }, s.eyebrow), h(Text, { style: styles.h1 }, s.heading), s.lead ? h(Text, { style: styles.lead }, s.lead) : null),
        ...s.blocks.map((b, j) => h(Block, { key: j, block: b, accent: brand.accent })),
      ),
    ),
    ...footer(),
  );

  const disclaimers = [brand.disclaimer, brand.franchiseDisclaimer].filter(Boolean);
  const card = (m, i, wide) =>
    h(
      View,
      { key: i, wrap: false, style: { width: wide ? "100%" : "48.5%", flexDirection: "row", alignItems: "center", backgroundColor: PAPER, padding: wide ? 22 : 14, marginBottom: 12 } },
      photos[i] ? h(View, { style: { marginRight: wide ? 18 : 12 } }, circle(i, wide ? 64 : 48)) : null,
      h(
        View,
        { style: { flex: 1 } },
        h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: wide ? 20 : 15, lineHeight: 1.2, marginBottom: 3 } }, m.name),
        m.title || brand.org ? h(Text, { style: { color: MUTED, fontSize: 9 } }, [m.title, brand.org].filter(Boolean).join(" · ")) : null,
        m.license ? h(Text, { style: { color: MUTED, fontSize: 8.5 } }, m.license) : null,
        h(View, { style: { marginTop: 6 } }, ...[m.phone, m.email, solo ? agent.website : ""].filter(Boolean).map((t, k) => h(Text, { key: k, style: { fontSize: wide ? 11 : 9.5 } }, t))),
      ),
    );
  const closing = h(
    Page,
    { size: "LETTER", style: styles.page },
    h(Eyebrow, { color: brand.accent }, "Next step"),
    h(Text, { style: { ...styles.h1, fontSize: 30 } }, "Let's talk."),
    h(Text, { style: { fontFamily: "Garamond", fontSize: 15, lineHeight: 1.5, marginTop: 12, color: "#3b3830" } }, `Every home and every move is different. If you have questions about anything in this guide, or you are ready to take the next step, reach out. ${solo ? "I would" : "We would"} be glad to help.`),
    h(View, { style: { marginTop: 28, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" } }, ...members.map((m, i) => card(m, i, solo))),
    solo || !agent.website ? null : h(Text, { style: { color: MUTED, fontSize: 10 } }, agent.website),
    brand.address ? h(Text, { style: { marginTop: 10, color: MUTED, fontSize: 9 } }, brand.address) : null,
    disclaimers.length ? h(Text, { style: { marginTop: 22, color: MUTED, fontSize: 7.5, lineHeight: 1.5 } }, disclaimers.join("\n\n")) : null,
    h(Text, { style: { marginTop: 10, color: MUTED, fontSize: 7.5, lineHeight: 1.5 } }, "This guide is general information, not legal, tax or financial advice. Talk with your own attorney, tax professional and lender about your situation. Equal Housing Opportunity."),
    ...footer(),
  );

  return renderToBuffer(h(Document, { title: `${title} — ${who}`, author: who, subject: guide.subtitle }, cover, content, closing));
}
