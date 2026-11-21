// Lays a CMA out as a PDF with @react-pdf/renderer: the same page the client sees (src/components/public/CmaReport.jsx) as a document. A dark cover band with
// the address, the suggested price and range, the market snapshot, the seller's net sheet when the agent chose to show it, how the homes compare, each home
// with its adjustments, the agent's notes, then the agent's details and the disclaimer. Pure like guidePdf.js: it takes the CMA (already cleaned), the agent,
// the brand and already-fetched images (PNG buffers) and returns a Buffer. See api/cma-pdf.js for where those come from.
import React from "react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { adjustedPrice, adjustmentTotal, computeCma, factsLine, pricePerSqft, subjectAddress, toNumber } from "../../src/lib/cma.js";
import { netScenarios } from "../../src/lib/netSheet.js";
import { formatPrice } from "../../src/lib/format.js";

const h = React.createElement;
const here = path.dirname(fileURLToPath(import.meta.url));
const font = (file) => path.join(here, "guide-fonts", file);
Font.register({ family: "Garamond", fonts: [{ src: font("EBGaramond-Regular.ttf"), fontWeight: 400 }, { src: font("EBGaramond-SemiBold.ttf"), fontWeight: 600 }] });
Font.register({ family: "Inter", fonts: [{ src: font("Inter-Regular.ttf"), fontWeight: 400 }, { src: font("Inter-SemiBold.ttf"), fontWeight: 600 }] });
Font.registerHyphenationCallback((word) => [word]);

const INK = "#1C1A17";
const MUTED = "#6B665A";
const RULE = "#E4DFD3";
const PAPER = "#F5F1E9";
const ACCENT = "#D8091B";
const money = (n) => (n < 0 ? `−${formatPrice(-n)}` : formatPrice(n));
const signed = (n) => `${n < 0 ? "−" : "+"}${formatPrice(Math.abs(n))}`;
const day = (s) => {
  const d = s ? new Date(`${String(s).slice(0, 10)}T12:00:00Z`) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
};
const STATUS = { sold: "Sold", pending: "Under contract", active: "For sale now" };
const DATE_LABEL = { sold: "Sold", pending: "Under contract", active: "Listed" };

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 62, paddingHorizontal: 54, fontFamily: "Inter", fontSize: 9.5, lineHeight: 1.5, color: INK },
  h2: { fontFamily: "Garamond", fontWeight: 600, fontSize: 19, lineHeight: 1.2 },
  h2Rule: { marginBottom: 8, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: RULE, borderBottomStyle: "solid" },
});

const Eyebrow = ({ children, color = ACCENT }) => h(Text, { style: { fontSize: 7.5, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 600, color } }, children);
// `keep` holds the heading and everything under it on one page (for a table that must not be split).
const Section = ({ title, count, children, first, keep }) =>
  h(
    View,
    { wrap: !keep, style: { marginTop: first ? 0 : 22 } },
    // The heading always travels with the first thing under it, so a heading is never left alone at the bottom of a page.
    h(View, { wrap: false }, h(View, { style: styles.h2Rule }, h(Text, { style: styles.h2 }, count != null ? `${title}  ${count}` : title)), React.Children.toArray(children)[0]),
    ...React.Children.toArray(children).slice(1),
  );

function Stat({ label, value, hint }) {
  return h(
    View,
    { wrap: false, style: { width: "24%", backgroundColor: PAPER, padding: 10 } },
    h(Text, { style: { fontSize: 6.8, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, color: MUTED } }, label),
    h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: 17, lineHeight: 1.2, marginTop: 2, marginBottom: 3 } }, String(value)),
    hint ? h(Text, { style: { fontSize: 7, color: MUTED, marginTop: 1 } }, hint) : null,
  );
}

function NetSheet({ rows }) {
  const lines = [];
  for (const s of rows) for (const l of s.lines) if (!lines.some((x) => x.key === l.key)) lines.push({ key: l.key, label: l.label });
  const hasPayoff = rows.some((s) => s.payoff);
  const labelW = 150;
  const cell = { flex: 1, textAlign: "right" };
  const row = (key, label, cells, style = {}, textStyle = {}) =>
    h(
      View,
      { key, wrap: false, style: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: RULE, borderBottomStyle: "solid", ...style } },
      h(Text, { style: { width: labelW, ...textStyle } }, label),
      ...cells.map((c, i) => h(Text, { key: i, style: { ...cell, ...textStyle } }, c)),
    );
  return h(
    View,
    { wrap: false, style: { borderWidth: 0.5, borderColor: RULE, borderStyle: "solid" } },
    row("head", "If it sells for", rows.map((s) => s.label), { backgroundColor: PAPER }, { fontSize: 7.5, fontWeight: 600, color: MUTED }),
    row("price", "Sale price", rows.map((s) => formatPrice(s.price)), {}, { fontFamily: "Garamond", fontWeight: 600, fontSize: 12 }),
    ...lines.map((l) => row(l.key, l.label, rows.map((s) => { const line = s.lines.find((x) => x.key === l.key); return line ? money(-line.amount) : "—"; }), {}, { color: "#3b3830" })),
    hasPayoff ? row("payoff", "Loan payoff", rows.map((s) => money(-s.payoff)), {}, { color: "#3b3830" }) : null,
    row("net", "What you walk away with", rows.map((s) => money(s.net)), { backgroundColor: INK, borderBottomWidth: 0 }, { color: "#FFFFFF", fontFamily: "Garamond", fontWeight: 600, fontSize: 12 }),
  );
}

function CompRow({ comp }) {
  const price = toNumber(comp.price);
  const adj = adjustmentTotal(comp);
  const ppsf = pricePerSqft(comp);
  const facts = [factsLine(comp), toNumber(comp.lot) != null ? `${comp.lot} lot` : "", comp.distance !== "" && comp.distance != null ? `${comp.distance} mi away` : ""].filter(Boolean).join("  ·  ");
  const sub = [comp.date && `${DATE_LABEL[comp.status] || "Sold"} ${day(comp.date)}`, toNumber(comp.dom) != null && `${comp.dom} days on market`].filter(Boolean).join("  ·  ");
  const adjustments = (comp.adjustments || []).filter((a) => toNumber(a.amount));
  return h(
    View,
    { wrap: false, style: { marginBottom: 8, padding: 10, backgroundColor: PAPER, borderLeftWidth: 2.5, borderLeftColor: ACCENT, borderLeftStyle: "solid" } },
    h(
      View,
      { style: { flexDirection: "row", justifyContent: "space-between" } },
      h(View, { style: { flex: 1, paddingRight: 10 } }, h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: 13, lineHeight: 1.2, marginBottom: 2 } }, String(comp.address || "Address not entered")), sub ? h(Text, { style: { color: MUTED, fontSize: 8.5 } }, sub) : null),
      h(View, { style: { alignItems: "flex-end" } }, h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: 15, lineHeight: 1.2, marginBottom: 2 } }, formatPrice(price)), ppsf != null ? h(Text, { style: { color: MUTED, fontSize: 7.5 } }, `$${Math.round(ppsf).toLocaleString("en-US")} per sqft`) : null),
    ),
    facts ? h(Text, { style: { marginTop: 3, color: "#3b3830", fontSize: 8.8 } }, facts) : null,
    adjustments.length
      ? h(
          View,
          { style: { marginTop: 6, paddingTop: 5, borderTopWidth: 0.5, borderTopColor: RULE, borderTopStyle: "solid" } },
          ...adjustments.map((a, i) => h(View, { key: i, style: { flexDirection: "row", justifyContent: "space-between" } }, h(Text, { style: { color: "#3b3830" } }, String(a.label || "Adjustment")), h(Text, { style: { color: "#3b3830" } }, signed(toNumber(a.amount))))),
          h(View, { style: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 } }, h(Text, { style: { fontWeight: 600 } }, "Adjusted to match your home"), h(Text, { style: { fontWeight: 600 } }, formatPrice(price + adj))),
        )
      : null,
    comp.notes ? h(Text, { style: { marginTop: 5, color: "#3b3830", fontSize: 8.8 } }, String(comp.notes)) : null,
  );
}

/**
 * @param cma     { title, subject, comps (only those to show), price_low, price_high, suggested_price, notes, net_sheet (only when to be shown), prepared }
 * @param agent   { name, title, license, phone, email } or null
 * @param brand   { org, address, disclaimer }
 * @param images  { logo, agentPhoto }: PNG buffers or null
 * @returns Promise<Buffer>
 */
export async function buildCmaPdf({ cma, agent, brand, images = {} }) {
  const m = computeCma(cma);
  const comps = (cma.comps || []).filter((c) => c.include !== false && toNumber(c.price) != null);
  const groups = [["Recently sold", comps.filter((c) => c.status === "sold")], ["Under contract", comps.filter((c) => c.status === "pending")], ["For sale now", comps.filter((c) => c.status === "active")]];
  const basisWord = m.basisKind === "pending" ? "pending" : "sold";
  const address = subjectAddress(cma.subject) || cma.title || "Your home";
  const net = cma.net_sheet?.show ? netScenarios(cma.net_sheet, m) : [];
  const adjusted = [...comps.filter((c) => c.status === "sold"), ...comps.filter((c) => c.status === "pending")].map((c) => ({ c, v: adjustedPrice(c) }));
  const first = (agent?.name || "").split(" ")[0] || "your agent";
  const stats = [
    m.averagePpsf != null && { label: "Avg price per sqft", value: `$${Math.round(m.averagePpsf).toLocaleString("en-US")}`, hint: m.byPricePerSqft ? `About ${formatPrice(m.byPricePerSqft)} for your home` : "" },
    m.averageDom != null && { label: "Avg days on market", value: Math.round(m.averageDom) },
    m.saleToList != null && { label: "Sold vs. list price", value: `${(m.saleToList * 100).toFixed(1)}%`, hint: "Average of the sold homes" },
    m.activeCount > 0 && { label: "Homes for sale now", value: m.activeCount, hint: m.activeLow != null ? `${formatPrice(m.activeLow)} to ${formatPrice(m.activeHigh)}` : "" },
  ].filter(Boolean);

  const foot = { position: "absolute", bottom: 30, fontSize: 8, color: MUTED };
  const footer = () => [
    h(View, { key: "rule", fixed: true, style: { position: "absolute", left: 54, right: 54, bottom: 44, height: 0.5, backgroundColor: RULE } }),
    h(Text, { key: "who", fixed: true, style: { ...foot, left: 54 } }, `Comparative market analysis  ·  ${address}`),
    h(Text, { key: "num", fixed: true, style: { ...foot, left: 54, width: 504, textAlign: "right" }, render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}` }),
  ];

  const header = h(
    View,
    { style: { backgroundColor: INK, color: "#FFFFFF", marginHorizontal: -54, marginTop: -48, paddingHorizontal: 54, paddingTop: 34, paddingBottom: 30, marginBottom: 24 } },
    images.logo ? h(Image, { src: { data: images.logo, format: "png" }, style: { height: 34, objectFit: "contain", objectPosition: "left", marginBottom: 22 } }) : brand.org ? h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: 16, marginBottom: 22 } }, brand.org) : null,
    h(Eyebrow, { color: "#B9B3A6" }, "Comparative market analysis"),
    h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: 30, lineHeight: 1.1, marginTop: 6, color: "#FFFFFF" } }, address),
    factsLine(cma.subject) ? h(Text, { style: { marginTop: 6, fontSize: 10.5, color: "#E4DFD3" } }, factsLine(cma.subject)) : null,
    h(Text, { style: { marginTop: 3, fontSize: 8.5, color: "#B9B3A6" } }, `Prepared ${day(cma.prepared || new Date().toISOString())}${agent?.name ? ` by ${agent.name}` : ""}`),
  );

  const price =
    m.suggested != null
      ? h(
          View,
          { wrap: false, style: { borderWidth: 0.5, borderColor: RULE, borderStyle: "solid", padding: 16 } },
          h(Eyebrow, {}, "Suggested price"),
          h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: 38, lineHeight: 1.2, marginTop: 2, marginBottom: 2 } }, formatPrice(m.suggested)),
          m.low != null && m.high != null ? h(Text, { style: { fontSize: 12, color: "#3b3830", marginTop: 2 } }, `Likely range ${formatPrice(m.low)} to ${formatPrice(m.high)}`) : null,
          h(Text, { style: { marginTop: 8, color: MUTED, fontSize: 8.5 } }, `Based on ${m.basisCount} comparable ${basisWord} home${m.basisCount === 1 ? "" : "s"}, each adjusted for how it differs from your home. This is a market opinion from your agent, not an appraisal.`),
        )
      : h(Text, { style: { color: MUTED } }, "Add sold homes to see a suggested price.");

  const agentCard = agent?.name
    ? h(
        View,
        { wrap: false, style: { marginTop: 22, flexDirection: "row", alignItems: "center", backgroundColor: PAPER, padding: 14 } },
        images.agentPhoto ? h(Image, { src: { data: images.agentPhoto, format: "png" }, style: { width: 50, height: 50, borderRadius: 25, objectFit: "cover", marginRight: 12 } }) : null,
        h(
          View,
          { style: { flex: 1 } },
          h(Text, { style: { fontFamily: "Garamond", fontWeight: 600, fontSize: 15, lineHeight: 1.2, marginBottom: 2 } }, agent.name),
          h(Text, { style: { color: MUTED, fontSize: 8.5 } }, [agent.title, brand.org].filter(Boolean).join("  ·  ")),
          agent.license ? h(Text, { style: { color: MUTED, fontSize: 8 } }, agent.license) : null,
          h(Text, { style: { marginTop: 3, fontSize: 9.5 } }, [agent.phone, agent.email].filter(Boolean).join("   ·   ")),
        ),
      )
    : null;

  const disclaimer = `This comparative market analysis is an opinion of value prepared by a real estate agent from the sales and listings shown. It is not an appraisal and should not be used as one.${brand.disclaimer ? ` ${brand.disclaimer}` : ""}`;

  const doc = h(
    Page,
    { size: "LETTER", style: styles.page, wrap: true },
    header,
    h(Section, { title: "Price opinion", first: true }, price),
    stats.length ? h(View, { style: { marginTop: 12, flexDirection: "row", justifyContent: "space-between" } }, ...stats.map((s, i) => h(Stat, { key: i, ...s }))) : null,
    net.length ? h(Section, { title: "What you'd walk away with", keep: true }, h(NetSheet, { rows: net }), h(Text, { style: { marginTop: 5, fontSize: 7.5, color: MUTED } }, "An estimate from the numbers above, not a closing statement. Actual costs depend on your contract, your loan payoff and your title company.")) : null,
    adjusted.length && m.suggested != null
      ? h(
          Section,
          { title: "How the homes compare" },
          ...adjusted.map(({ c, v }, i) =>
            h(View, { key: i, wrap: false, style: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: RULE, borderBottomStyle: "solid" } }, h(Text, { style: { flex: 1 } }, String(c.address || "Address not entered")), h(Text, { style: { width: 90, textAlign: "right" } }, formatPrice(v))),
          ),
          h(View, { key: "sug", wrap: false, style: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 } }, h(Text, { style: { fontWeight: 600, color: ACCENT } }, "Suggested price"), h(Text, { style: { width: 90, textAlign: "right", fontWeight: 600, color: ACCENT } }, formatPrice(m.suggested))),
          h(Text, { key: "note", style: { marginTop: 2, fontSize: 7.5, color: MUTED } }, "Each price is adjusted to match your home."),
        )
      : null,
    ...groups.map(([label, list]) => (list.length ? h(Section, { key: label, title: label, count: list.length }, ...list.map((c, i) => h(CompRow, { key: c.id || i, comp: c }))) : null)),
    cma.notes ? h(Section, { title: `Notes from ${first}` }, ...String(cma.notes).split(/\n+/).map((t) => t.trim()).filter(Boolean).map((t, i) => h(Text, { key: i, style: { color: "#3b3830", lineHeight: 1.45, marginBottom: 4 } }, t))) : null,
    agentCard,
    brand.address ? h(Text, { style: { marginTop: 10, color: MUTED, fontSize: 8.5 } }, brand.address) : null,
    h(Text, { style: { marginTop: 14, color: MUTED, fontSize: 7.5, lineHeight: 1.5 } }, disclaimer),
    ...footer(),
  );

  return renderToBuffer(h(Document, { title: `Comparative market analysis — ${address}`, author: agent?.name || brand.org || "", subject: "Comparative market analysis" }, doc));
}
