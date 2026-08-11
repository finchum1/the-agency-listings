import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// Real access control lives in Supabase RLS (see supabase/schema.sql) —
// this is UX only, same philosophy as debt-tracker-app's route guards.
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { session, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <p className="text-[#1c1a17]/40 text-sm">Loading…</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;

  return children;
}
