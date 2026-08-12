import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { isAppHost } from "./lib/appHosts";

import LoginPage from "./components/auth/LoginPage";
import SetPasswordPage from "./components/auth/SetPasswordPage";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import ListingsTable from "./components/dashboard/ListingsTable";
import NewListingPage from "./components/dashboard/NewListingPage";
import EditListingPage from "./components/dashboard/EditListingPage";
import AgentsPage from "./components/dashboard/AgentsPage";
import MyProfilePage from "./components/dashboard/MyProfilePage";
import MySitePage from "./components/dashboard/MySitePage";
import SitesPage from "./components/dashboard/SitesPage";
import EditAgentSitePage from "./components/dashboard/EditAgentSitePage";
import PublicListingPage from "./pages/PublicListingPage";
import CustomDomainSitePage from "./pages/CustomDomainSitePage";
import PublicAgentSitePage from "./pages/PublicAgentSitePage";
import PublicAgentPostPage from "./pages/PublicAgentPostPage";
import NotFoundPage from "./pages/NotFoundPage";
import LandingPage from "./pages/LandingPage";

function Root() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

export default function App() {
  // A request arriving on a listing's or an agent site's own attached
  // custom domain (e.g. 1645SaratogaWay.com, TerrenceFinchumRealty.com)
  // should just show that listing/site at "/", regardless of path — skip
  // the app's normal routing entirely for that case.
  if (!isAppHost(window.location.hostname)) {
    return <CustomDomainSitePage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<SetPasswordPage />} />

      <Route path="/listings/:slug" element={<PublicListingPage />} />
      <Route path="/sites/:slug" element={<PublicAgentSitePage />} />
      <Route path="/sites/:slug/blog/:postSlug" element={<PublicAgentPostPage />} />

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
        <Route path="site" element={<MySitePage />} />
        <Route
          path="agents"
          element={
            <ProtectedRoute adminOnly>
              <AgentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sites"
          element={
            <ProtectedRoute adminOnly>
              <SitesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sites/:agentId"
          element={
            <ProtectedRoute adminOnly>
              <EditAgentSitePage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
