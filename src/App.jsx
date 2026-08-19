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
import FlyerPage from "./components/dashboard/FlyerPage";
import AgentsPage from "./components/dashboard/AgentsPage";
import UpcomingListingsPage from "./components/dashboard/UpcomingListingsPage";
import BuyerNeedsPage from "./components/dashboard/BuyerNeedsPage";
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
import AgentWebsitesPage from "./pages/AgentWebsitesPage";
import PropertyWebsitesPage from "./pages/PropertyWebsitesPage";
import UpcomingPage from "./pages/UpcomingPage";
// TEMPORARY — see ModulePreview.jsx's own header comment. Remove this
// import + its route below once the marketing screenshots are captured.
import ModulePreview from "./pages/marketing/ModulePreview";

import HomeSections from "./components/agent-site/HomeSections";
import Bio from "./components/agent-site/Bio";
import Testimonials from "./components/agent-site/Testimonials";
import FeaturedListings from "./components/agent-site/FeaturedListings";
import ServiceAreas from "./components/agent-site/ServiceAreas";
import BlogTeaser from "./components/agent-site/BlogTeaser";
import Contact from "./components/agent-site/Contact";

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
      <Route path="/agent-websites" element={<AgentWebsitesPage />} />
      <Route path="/property-websites" element={<PropertyWebsitesPage />} />
      <Route path="/upcoming" element={<UpcomingPage />} />
      <Route path="/marketing-preview" element={<ModulePreview />} />{/* TEMPORARY */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<SetPasswordPage />} />

      <Route path="/listings/:slug" element={<PublicListingPage />} />

      {/* Home is the full overview — HomeSections.jsx composes it from
          agent_sites.home_sections (which optional sections, what order;
          Hero/Contact are fixed) — and each section is ALSO its own
          standalone page reachable from Navbar.jsx's nav links (which
          always point at those dedicated pages, never Home's anchors) —
          see Navbar.jsx's PAGES list, which must match these paths. */}
      <Route
        path="/sites/:slug"
        element={
          <PublicAgentSitePage>
            <HomeSections />
          </PublicAgentSitePage>
        }
      />
      <Route
        path="/sites/:slug/about"
        element={
          <PublicAgentSitePage pageTitle="About">
            <Bio />
            <Testimonials />
          </PublicAgentSitePage>
        }
      />
      <Route
        path="/sites/:slug/listings"
        element={
          <PublicAgentSitePage pageTitle="Listings">
            <FeaturedListings />
          </PublicAgentSitePage>
        }
      />
      <Route
        path="/sites/:slug/areas"
        element={
          <PublicAgentSitePage pageTitle="Areas">
            <ServiceAreas />
          </PublicAgentSitePage>
        }
      />
      <Route
        path="/sites/:slug/blog"
        element={
          <PublicAgentSitePage pageTitle="Blog">
            <BlogTeaser />
          </PublicAgentSitePage>
        }
      />
      <Route
        path="/sites/:slug/contact"
        element={
          <PublicAgentSitePage pageTitle="Contact">
            <Contact />
          </PublicAgentSitePage>
        }
      />
      <Route path="/sites/:slug/blog/:postSlug" element={<PublicAgentPostPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MySitePage />} />
        <Route path="listings" element={<ListingsTable />} />
        <Route path="listings/new" element={<NewListingPage />} />
        <Route path="listings/:id/edit" element={<EditListingPage />} />
        <Route path="listings/:id/flyer" element={<FlyerPage />} />
        <Route path="profile" element={<MyProfilePage />} />
        <Route path="site" element={<MySitePage />} />
        <Route path="upcoming-listings" element={<UpcomingListingsPage />} />
        <Route path="buyer-needs" element={<BuyerNeedsPage />} />
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
