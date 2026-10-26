import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { dealAccess } from "../../../lib/deals";

// UX gate only: RLS decides which deals anyone can actually read (the agent's own, their coordinator's, and compliance's).
export default function DealsGate() {
  const { profile, loading } = useAuth();
  if (loading) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;
  if (!dealAccess(profile).any) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
