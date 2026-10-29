import { Link, Outlet, useLocation } from "react-router-dom";

// The pages of the People module, as a row of pills across the top of the module with the chosen page under it. People is a single entry in the
// dashboard menu; this is where its parts are. Across the top rather than down the side so the boards keep their full width.
const PAGES = [
  { to: "/dashboard/people/overview", label: "Overview" },
  { to: "/dashboard/people/leads", label: "Leads" },
  { to: "/dashboard/people/pipeline", label: "Pipeline" },
  { to: "/dashboard/people/contacts", label: "Contacts" },
];
const SETTINGS = { to: "/dashboard/settings", label: "Settings" };

export default function PeopleLayout() {
  const { pathname } = useLocation();
  const active = (item) => pathname === item.to || pathname.startsWith(`${item.to}/`);
  const pill = (item, extra = "") => (
    <Link
      key={item.to}
      to={item.to}
      aria-current={active(item) ? "page" : undefined}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
        active(item) ? "bg-[#1c1a17] dark:bg-[#faf9f7] text-white dark:text-[#1c1a17]" : "text-[#1c1a17]/65 dark:text-[#faf9f7]/65 hover:bg-black/5 dark:hover:bg-white/10"
      } ${extra}`}
    >
      {item.label}
    </Link>
  );
  return (
    <div>
      <nav aria-label="People pages" className="mb-6 flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PAGES.map((p) => pill(p))}
        {pill(SETTINGS, "ml-auto")}
      </nav>
      <Outlet />
    </div>
  );
}
