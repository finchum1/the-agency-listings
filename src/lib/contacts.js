// Shared helpers for the Contacts CRM (People > Contacts): labels, tag colors, filtering, and CSV in and out.
import { agoLabel, daysBetween, toKey } from "./homeDates.js";

export const RELATIONSHIPS = [
  { value: "client", label: "Client" },
  { value: "past_client", label: "Past client" },
  { value: "lead", label: "Lead" },
  { value: "sphere", label: "Sphere of influence" },
  { value: "referral_partner", label: "Referral partner" },
  { value: "vendor", label: "Vendor" },
  { value: "agent", label: "Agent" },
  { value: "lender", label: "Lender" },
  { value: "other", label: "Other" },
];
export const relationshipLabel = (v) => RELATIONSHIPS.find((r) => r.value === v)?.label || "Other";

export const TOUCH_OPTIONS = [
  { value: "", label: "No reminder" },
  { value: 14, label: "Every 2 weeks" },
  { value: 30, label: "Every month" },
  { value: 60, label: "Every 2 months" },
  { value: 90, label: "Every 3 months" },
  { value: 180, label: "Every 6 months" },
  { value: 365, label: "Every year" },
];

export const NOTE_KINDS = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "showing", label: "Showing" },
];

// Chip colors for tags; each name is allowed by contact_tags' check constraint.
export const TAG_COLORS = {
  gray: "bg-black/[0.07] text-[#1c1a17]/75 dark:bg-white/10 dark:text-[#faf9f7]/80",
  red: "bg-red-500/15 text-red-800 dark:text-red-300",
  orange: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  amber: "bg-amber-500/20 text-amber-900 dark:text-amber-300",
  green: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  teal: "bg-teal-500/15 text-teal-800 dark:text-teal-300",
  blue: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  violet: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
  pink: "bg-pink-500/15 text-pink-800 dark:text-pink-300",
};
export const TAG_COLOR_NAMES = Object.keys(TAG_COLORS);

export const fullName = (c) => [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.company || "Unnamed";
export const initials = (c) => (((c.first_name || "")[0] || "") + ((c.last_name || "")[0] || "") || (c.company || "?")[0]).toUpperCase();
export const digits = (s) => String(s || "").replace(/\D/g, "");
export const cityLine = (c) => [c.city, c.state].filter(Boolean).join(", ");

const todayKey = () => toKey(new Date());
const dayKey = (iso) => toKey(new Date(iso));

/** Days since someone was last in touch with, or null when never. */
export const daysSinceContact = (c) => (c.last_contacted_at ? Math.max(0, daysBetween(dayKey(c.last_contacted_at), todayKey())) : null);
export const lastContactLabel = (c) => {
  const d = daysSinceContact(c);
  return d == null ? "Never" : agoLabel(d);
};

/** The "keep in touch" reminder is due once that many days have passed since the last contact (or since they were added). */
export function touchDue(c) {
  if (!c.touch_every_days || c.archived || c.do_not_contact) return false;
  const since = c.last_contacted_at || c.created_at;
  return daysBetween(dayKey(since), todayKey()) >= c.touch_every_days;
}

// ---- filtering: the same shape of `filters` is what a saved smart list stores ----
export const EMPTY_FILTERS = { q: "", relationship: "", tags: [], board: "", contacted: "", followup: "", touch: false, archived: false };

export function hasFilters(f) {
  return Boolean(f.q || f.relationship || f.tags?.length || f.board || f.contacted || f.followup || f.touch || f.archived);
}

/**
 * ctx: { tagsByContact: Map(id -> [tagId]), boardsByContact: Map(id -> Set(group)), nextTaskByContact: Map(id -> due date or "") }
 */
export function applyFilters(contacts, f, ctx) {
  const words = String(f.q || "").toLowerCase().split(/\s+/).filter(Boolean);
  const today = todayKey();
  const weekEnd = toKey(new Date(Date.now() + 7 * 864e5));
  return contacts.filter((c) => {
    if (!!c.archived !== !!f.archived) return false;
    if (words.length) {
      const text = `${c.search_text} ${fullName(c).toLowerCase()}`;
      const dg = digits(text);
      if (!words.every((w) => text.includes(w) || (/^\d{3,}$/.test(w) && dg.includes(w)))) return false;
    }
    if (f.relationship && c.relationship !== f.relationship) return false;
    if (f.tags?.length) {
      const mine = ctx.tagsByContact.get(c.id) || [];
      if (!f.tags.some((t) => mine.includes(t))) return false;
    }
    if (f.board) {
      const boards = ctx.boardsByContact.get(c.id);
      if (f.board === "none" ? boards && boards.size : !boards || !boards.has(f.board)) return false;
    }
    if (f.contacted) {
      const d = daysSinceContact(c);
      if (f.contacted === "never") {
        if (d != null) return false;
      } else if (d != null && d < Number(f.contacted)) return false;
    }
    if (f.followup) {
      const due = ctx.nextTaskByContact.get(c.id) || "";
      if (f.followup === "overdue" && !(due && due < today)) return false;
      if (f.followup === "week" && !(due && due >= today && due <= weekEnd)) return false;
      if (f.followup === "none" && due) return false;
    }
    if (f.touch && !touchDue(c)) return false;
    return true;
  });
}

export const SORTS = [
  { value: "name", label: "Name A to Z" },
  { value: "recent", label: "Recently added" },
  { value: "contacted", label: "Longest since contact" },
  { value: "followup", label: "Next follow-up" },
];

export function sortContacts(list, sort, ctx) {
  const by = {
    name: (a, b) => fullName(a).localeCompare(fullName(b), undefined, { sensitivity: "base" }),
    recent: (a, b) => b.created_at.localeCompare(a.created_at),
    contacted: (a, b) => (a.last_contacted_at || "").localeCompare(b.last_contacted_at || "") || fullName(a).localeCompare(fullName(b)),
    followup: (a, b) => {
      const da = ctx.nextTaskByContact.get(a.id) || "9999";
      const db = ctx.nextTaskByContact.get(b.id) || "9999";
      return da.localeCompare(db) || fullName(a).localeCompare(fullName(b));
    },
  };
  return [...list].sort(by[sort] || by.name);
}

// ---- CSV ----
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const src = String(text).replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
export function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

export const IMPORT_FIELDS = [
  { key: "first_name", label: "First name", guess: /^(first|given)[ _-]*name$|^first$/i },
  { key: "last_name", label: "Last name", guess: /^(last|family|sur)[ _-]*name$|^last$/i },
  { key: "full_name", label: "Full name", guess: /^(full[ _-]*)?name$|^contact$/i },
  { key: "email", label: "Email", guess: /e-?mail/i },
  { key: "phone", label: "Phone", guess: /phone|mobile|cell/i },
  { key: "company", label: "Company", guess: /company|organization|business/i },
  { key: "address_line1", label: "Address", guess: /^(street|address)( ?1| line 1)?$|street address/i },
  { key: "city", label: "City", guess: /^city$/i },
  { key: "state", label: "State", guess: /^state|province/i },
  { key: "zip", label: "Zip", guess: /zip|postal/i },
  { key: "birthday", label: "Birthday", guess: /birth/i },
  { key: "home_anniversary", label: "Housiversary (home anniversary)", guess: /housiversary|anniversar|home ?purchase|purchase ?date|closed? ?(on|date)|closing ?date/i },
  { key: "relationship", label: "Relationship (client, past client, lead…)", guess: /^relationship$|^(contact[ _-]*)?(type|category)$/i },
  { key: "source", label: "Source", guess: /source|lead source/i },
  { key: "tags", label: "Tags (separated by ; or ,)", guess: /^tags?$|labels?|groups?/i },
  { key: "about", label: "Notes", guess: /notes?|comments?|about/i },
];

/** Picks a column for each field by its header. Returns { field: columnIndex | -1 }. */
export function guessMapping(headers) {
  const map = {};
  const used = new Set();
  for (const f of IMPORT_FIELDS) {
    const i = headers.findIndex((h, idx) => !used.has(idx) && f.guess.test(String(h).trim()));
    map[f.key] = i;
    if (i >= 0) used.add(i);
  }
  return map;
}

// A date typed in a spreadsheet: 2019-03-15, 3/15/2019, 3/15/19 or "March 15, 2019". Read by hand where the format is known so a
// day never slips across a time zone (new Date("2019-03-15") is midnight UTC, which is the 14th in Oklahoma).
const toIsoDate = (s) => {
  const t = String(s || "").trim();
  if (!t) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const valid = (y, m, d) => {
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
  };
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] - (+m[3] > 30 ? 100 : 0) : +m[3], +m[1], +m[2]);
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : valid(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

/** "Past Client", "past_client", "Lender"... -> a relationship value, or "" when it isn't one we know. */
export function parseRelationship(s) {
  const t = String(s || "").trim().toLowerCase();
  if (!t) return "";
  if (/past|former|previous/.test(t)) return "past_client";
  if (/referral/.test(t)) return "referral_partner";
  if (/lender|loan|mortgage/.test(t)) return "lender";
  if (/vendor|contractor|inspector|title|insurance/.test(t)) return "vendor";
  if (/agent|realtor|broker/.test(t)) return "agent";
  if (/client|buyer|seller/.test(t)) return "client";
  if (/lead|prospect/.test(t)) return "lead";
  if (/sphere|soi|friend|family|neighbor/.test(t)) return "sphere";
  return "other";
}

/** One CSV row -> a contact insert (without owner), or null when it has no usable name. */
export function rowToContact(row, map, defaults) {
  const get = (k) => (map[k] >= 0 ? String(row[map[k]] ?? "").trim() : "");
  let first = get("first_name");
  let last = get("last_name");
  const full = get("full_name");
  if (!first && !last && full) {
    const parts = full.split(/\s+/);
    last = parts.length > 1 ? parts.pop() : "";
    first = parts.join(" ");
  }
  const company = get("company");
  if (!first && !last && !company) return null;
  return {
    first_name: first,
    last_name: last,
    company,
    email: get("email").toLowerCase(),
    phone: get("phone"),
    address_line1: get("address_line1"),
    city: get("city"),
    state: get("state"),
    zip: get("zip"),
    birthday: toIsoDate(get("birthday")),
    home_anniversary: toIsoDate(get("home_anniversary")),
    source: get("source") || defaults.source || "",
    about: get("about"),
    relationship: parseRelationship(get("relationship")) || defaults.relationship,
    tagNames: get("tags").split(/[;,|]/).map((t) => t.trim()).filter(Boolean),
  };
}
