import { AddressBook, Browser, CalendarBlank, Handshake, House, Kanban } from "@phosphor-icons/react";
import BrainMap from "./BrainMap";

// The Agency page's hero: a map of what comes with the dashboard. The discs are the parts of the product (the website,
// your day, contacts, the pipeline, deals, listings); the pills are what you get out of them. Point at one and
// everything it works with lights up. Every line here is something the product does today.

const caps = [
  { id: "website", label: "Website", blurb: "Your own site on The Agency's brand and your own domain, from three starter templates, with a blog.", at: [196, 225], above: true, Icon: Browser },
  { id: "day", label: "Your day", blurb: "An hourly schedule that syncs with Google Calendar, with new inquiries, tasks, and who to follow up with today.", at: [300, 170], above: true, Icon: CalendarBlank },
  { id: "listings", label: "Listings", blurb: "Status, price, photos, and open houses in one place, with a property site for every listing.", at: [404, 225], above: true, Icon: House },
  { id: "deals", label: "Deals", blurb: "Key dates, checklists, a coordinator, and compliance review on one board, from contract to close.", at: [404, 335], Icon: Handshake },
  { id: "pipeline", label: "Pipeline", blurb: "Drag people between columns. Every column has its own follow-up rhythm, so the next call is always on your list.", at: [300, 390], Icon: Kanban },
  { id: "contacts", label: "Contacts", blurb: "Your own private database with tags and keep-in-touch reminders, so nobody you know slips away.", at: [196, 335], Icon: AddressBook },
];

// Clockwise from the way in.
const items = [
  { id: "templates", label: "Templates", blurb: "Three finished looks to start from: luxury minimal, warm editorial, and guide cards. Then make it yours.", at: [210, 81], uses: ["website"] },
  { id: "propsites", label: "Property sites", blurb: "A site for every listing, with photos, video, a map, and a private report page you can send the seller.", at: [390, 81], uses: ["listings", "website"] },
  { id: "analytics", label: "Visitor analytics", blurb: "Views, visitors, and where they came from, with a tagged link for every place you share a listing.", at: [517, 198], uses: ["listings", "pipeline", "website"] },
  { id: "flyers", label: "Flyers", blurb: "Three print-ready styles, filled in from the listing. Print one or save it as a PDF.", at: [517, 362], uses: ["listings"] },
  { id: "clients", label: "Client links", blurb: "A closing timeline for each client, with a countdown and what's next, and no login to forget.", at: [390, 479], uses: ["deals", "contacts"] },
  { id: "coordinator", label: "Coordinator", blurb: "Bring your transaction coordinator and your compliance reviewer in, with just the access they need.", at: [210, 479], uses: ["deals", "day"] },
  { id: "blog", label: "Blog", blurb: "A post calendar, pinned posts, and a Recently Sold section under your listings.", at: [83, 362], uses: ["website", "contacts"] },
];

export default function AgencyBrain({ ctaHref }) {
  const config = {
    ariaLabel: "Map of what comes with the dashboard for Agency agents",
    centre: {
      label: "The Agency dashboard",
      mark: <img src="/images/agency-app-icon.png" alt="" width="64" height="64" />,
      info: { title: "One dashboard", blurb: "Your website and your back office, on one login, already running at The Agency.", tag: "The Agency" },
    },
    caps,
    items,
    capTag: (_cap, used) => `Included · connects to ${used.length} ${used.length === 1 ? "thing" : "things"}`,
    itemTag: "Included",
    idea: {
      at: [83, 198],
      label: "Request access",
      ariaLabel: "Request early access: yours is next",
      href: ctaHref,
      info: { title: "Yours is next", blurb: "Tell us about your site and your office, and we'll set you up.", tag: "Start here", href: ctaHref, cta: "Request early access" },
    },
    defaultInfo: {
      title: "A website and a back office, connected.",
      blurb: "Hover or tap anything to see what it does and what it works with.",
    },
  };
  return <BrainMap config={config} />;
}
