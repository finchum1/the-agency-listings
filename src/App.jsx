import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

import LoginPage from "./components/auth/LoginPage";
import SetPasswordPage from "./components/auth/SetPasswordPage";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import ListingsTable from "./components/dashboard/ListingsTable";
import NewListingPage from "./components/dashboard/NewListingPage";
import EditListingPage from "./components/dashboard/EditListingPage";
import AgentsPage from "./components/dashboard/AgentsPage";
import MyProfilePage from "./components/dashboard/MyProfilePage";
import PublicListingPage from "./pages/PublicListingPage";
import NotFoundPage from "./pages/NotFoundPage";

function Root() {
  const { session, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={session ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<SetPasswordPage />} />

      <Route path="/listings/:slug" element={<PublicListingPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ListingsTable />} />
        <Route path="listings/new" element={<NewListingPage />} />
        <Route path="listings/:id/edit" element={<EditListingPage />} />
        <Route path="profile" element={<MyProfilePage />} />
        <Route
          path="agents"
          element={
            <ProtectedRoute adminOnly>
              <AgentsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
