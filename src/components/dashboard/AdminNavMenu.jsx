import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// Groups the admin-only destinations (Sites, Agents) under one "Admin"
// trigger instead of two extra flat pills in the header nav — both frees
// up header width (helps the mobile-overlap fix in DashboardLayout.jsx)
// and reads better for what these actually are: office settings, not
// day-to-day modules every agent uses.
export default function AdminNavMenu({ active, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 text-sm font-medium px-4 py-2 rounded-full transition-colors ${
          active || open ? "bg-[#1c1a17]/10 text-[#1c1a17]" : "text-[#1c1a17]/70 hover:bg-black/5"
        }`}
      >
        Admin
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white border border-black/10 rounded-xl shadow-lg overflow-hidden z-20">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-[#1c1a17]/80 hover:bg-black/5"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
