import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";

// UX gate only — RLS on people/people_notes also requires
// profiles.people_enabled, so a hand-typed URL can't read anything.
export default function PeopleGate() {
  const { profile, loading } = useAuth();
  if (loading) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;
  if (!profile?.people_enabled) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
