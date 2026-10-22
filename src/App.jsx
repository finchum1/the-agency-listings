import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { OrgProvider } from "./context/OrgContext";
import { useHostOrg } from "./hooks/useHostOrg";
import { useHostBranding } from "./hooks/useHostBranding";
import { isAppHost, isDashboardOnlyHost, isMarketingHost } from "./lib/appHosts";
import useSwUpdateOnNavigate from "./hooks/useSwUpdateOnNavigate";
import { isStandalone } from "./lib/pwa";

import LoginPage from "./components/auth/LoginPage";
import SetPasswordPage from "./components/auth/SetPasswordPage";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import ListingsTable from "./components/dashboard/ListingsTable";
import NewListingPage from "./components/dashboard/NewListingPage";
import EditListingPage from "./components/dashboard/EditListingPage";
import FlyerPage from "./components/dashboard/FlyerPage";
import AgentsPage from "./components/dashboard/AgentsPage";
import UpcomingModule from "./components/dashboard/UpcomingModule";
import MyProfilePage from "./components/dashboard/MyProfilePage";
import MySitePage from "./components/dashboard/MySitePage";
import DashboardHome from "./components/dashboard/DashboardHome";
import SitesPage from "./components/dashboard/SitesPage";
import EditAgentSitePage from "./components/dashboard/EditAgentSitePage";
import PublicListingPage from "./pages/PublicListingPage";
import CustomDomainSitePage from "./pages/CustomDomainSitePage";
import PublicAgentSitePage from "./pages/PublicAgentSitePage";
import PublicAgentPostPage from "./pages/PublicAgentPostPage";
import PublicAgentAreaPage from "./pages/PublicAgentAreaPage";
import SitePreviewPage, { PreviewSite } from "./pages/SitePreviewPage";
import NotFoundPage from "./pages/NotFoundPage";
import { AboutPage, PrivacyPage, TermsPage } from "./pages/LegalPages";
import LandingPage from "./pages/LandingPage";
import AgentWebsitesPage from "./pages/AgentWebsitesPage";
import PropertyWebsitesPage from "./pages/PropertyWebsitesPage";
import UpcomingPage from "./pages/UpcomingPage";
import PeoplePage from "./pages/PeoplePage";
import BrokerageWebsitePage from "./pages/BrokerageWebsitePage";
import BrokerageSitePage from "./pages/BrokerageSitePage";
import BrokeragePostPage from "./pages/BrokeragePostPage";
import BrokerageAreaPage from "./pages/BrokerageAreaPage";
import BrokerageSiteEditor from "./components/dashboard/BrokerageSiteEditor";
import PeopleGate from "./components/dashboard/people/PeopleGate";
import PeopleBoard from "./components/dashboard/people/PeopleBoard";
import PeopleOverview from "./components/dashboard/people/PeopleOverview";
import SettingsPage from "./components/dashboard/people/SettingsPage";
import BrandSettingsPage from "./components/dashboard/BrandSettingsPage";
import OrganizationsPage from "./components/dashboard/OrganizationsPage";

import HomeSections from "./components/agent-site/HomeSections";
import Bio from "./components/agent-site/Bio";
import Testimonials from "./components/agent-site/Testimonials";
import FeaturedListings from "./components/agent-site/FeaturedListings";
import ServiceAreas from "./components/agent-site/ServiceAreas";
import BlogTeaser from "./components/agent-site/BlogTeaser";
import Contact from "./components/agent-site/Contact";

import BrokerageHomeSections from "./components/brokerage-site/HomeSections";
import BrokerageAbout from "./components/brokerage-site/About";
import BrokerageAgentRoster from "./components/brokerage-site/AgentRoster";
import BrokerageAreasOfExpertise from "./components/brokerage-site/AreasOfExpertise";
import BrokerageBlogList from "./components/brokerage-site/BlogList";
import BrokerageContactCard from "./components/brokerage-site/ContactCard";
import IdxListings from "./components/brokerage-site/IdxListings";
import IdxListingDetail from "./components/brokerage-site/IdxListingDetail";
import HomeValuation from "./components/brokerage-site/HomeValuation";

function Root({ dashboardOnly = false, productHome = false }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  // The installed home-screen app is for signing in and working, not for reading about the product.
  if (isStandalone()) return <Navigate to="/login" replace />;
  // The platform's own dashboard host (app.latchpointstudios.com) is also the product's public home page, the address
  // Google's consent screen points to: signed-out visitors read about it there and sign in. A brokerage's own dashboard
  // domain goes straight to sign-in.
  if (productHome) return <AboutPage />;
  if (dashboardOnly) return <Navigate to="/login" replace />;
  return <LandingPage />;
}

export default function App() {
  // Called unconditionally (before the early return below) per the
  // Rules of Hooks — harmless on a custom domain too, since main.jsx
  // never registers a service worker there in the first place, so the
  // checker stays a no-op.
  useSwUpdateOnNavigate();
  // A hostname that is not one of the platform's own may still be a brokerage's dashboard domain (org_domains).
  const hostOrg = useHostOrg();
  useHostBranding(hostOrg.isApp ? hostOrg.org : null);

  // A request arriving on a marketing-only host (see appHosts.js) gets
  // just the standalone product-marketing pages — no login/dashboard,
  // no per-site custom-domain resolution. Checked first since these
  // hostnames aren't in KNOWN_APP_HOSTS and would otherwise fall through
  // to the custom-domain branch below.
  if (isMarketingHost(window.location.hostname)) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/agent-websites" element={<AgentWebsitesPage />} />
        <Route path="/property-websites" element={<PropertyWebsitesPage />} />
        <Route path="/brokerage-website" element={<BrokerageWebsitePage />} />
        <Route path="/upcoming" element={<UpcomingPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    );
  }

  // A request arriving on a listing's or an agent site's own attached
  // custom domain (e.g. 1645SaratogaWay.com, TerrenceFinchumRealty.com)
  // should just show that listing/site at "/", regardless of path — skip
  // the app's normal routing entirely for that case.
  if (hostOrg.loading) return null; // unknown host: the registry is answering (a moment, once per page load)
  if (!isAppHost(window.location.hostname) && !hostOrg.isApp) {
    return <CustomDomainSitePage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Root dashboardOnly={isDashboardOnlyHost(window.location.hostname) || hostOrg.isApp} productHome={isDashboardOnlyHost(window.location.hostname) && !hostOrg.isApp} />} />
      <Route path="/agent-websites" element={<AgentWebsitesPage />} />
      <Route path="/property-websites" element={<PropertyWebsitesPage />} />
      <Route path="/brokerage-website" element={<BrokerageWebsitePage />} />
      <Route path="/upcoming" element={<UpcomingPage />} />
        <Route path="/people" element={<PeoplePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
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
      <Route path="/sites/:slug/areas/:areaSlug" element={<PublicAgentAreaPage />} />
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

      {/* Template comparison share links: no sign-in, the token in the address is the credential. /preview/:token is the
          page the agent opens; the /site routes are the frames inside it (and "Open full size"). */}
      <Route path="/preview/:token" element={<SitePreviewPage />} />
      <Route
        path="/preview/:token/site"
        element={
          <PreviewSite>
            <HomeSections />
          </PreviewSite>
        }
      />
      <Route
        path="/preview/:token/site/about"
        element={
          <PreviewSite pageTitle="About">
            <Bio />
            <Testimonials />
          </PreviewSite>
        }
      />
      <Route
        path="/preview/:token/site/listings"
        element={
          <PreviewSite pageTitle="Listings">
            <FeaturedListings />
          </PreviewSite>
        }
      />
      <Route
        path="/preview/:token/site/areas"
        element={
          <PreviewSite pageTitle="Areas">
            <ServiceAreas />
          </PreviewSite>
        }
      />
      <Route
        path="/preview/:token/site/blog"
        element={
          <PreviewSite pageTitle="Blog">
            <BlogTeaser />
          </PreviewSite>
        }
      />
      <Route
        path="/preview/:token/site/contact"
        element={
          <PreviewSite pageTitle="Contact">
            <Contact />
          </PreviewSite>
        }
      />

      {/* Brokerage Site — the office's own public site (singleton, admin-
          edited from /dashboard/brokerage-site), theme/font/accent/logo/
          home-sections customizable the same way an agent site is (see
          BrokerageSiteForm.jsx). Parallel in shape to the /sites/:slug
          routes above, minus the :slug param since there's only one.

          Home is the full overview — HomeSections.jsx composes it from
          brokerage_site.home_sections (which optional sections, what
          order; Hero/Contact are fixed) — and each optional section is
          ALSO its own standalone page reachable from Navbar.jsx's nav
          links (which always point at those dedicated pages, never
          Home's anchors) — see Navbar.jsx's PAGES list, which must match
          these paths. */}
      <Route
        path="/brokerage"
        element={
          <BrokerageSitePage path="/brokerage">
            <BrokerageHomeSections />
          </BrokerageSitePage>
        }
      />
      <Route
        path="/brokerage/about"
        element={
          <BrokerageSitePage path="/brokerage/about" pageTitle="About">
            <BrokerageAbout isStandalonePage />
          </BrokerageSitePage>
        }
      />
      <Route
        path="/brokerage/agents"
        element={
          <BrokerageSitePage path="/brokerage/agents" pageTitle="Agents">
            <BrokerageAgentRoster isStandalonePage />
          </BrokerageSitePage>
        }
      />
      <Route
        path="/brokerage/areas"
        element={
          <BrokerageSitePage path="/brokerage/areas" pageTitle="Areas of Expertise">
            <BrokerageAreasOfExpertise isStandalonePage />
          </BrokerageSitePage>
        }
      />
      <Route path="/brokerage/areas/:areaSlug" element={<BrokerageAreaPage />} />
      <Route
        path="/brokerage/blog"
        element={
          <BrokerageSitePage path="/brokerage/blog" pageTitle="Blog">
            <BrokerageBlogList isStandalonePage />
          </BrokerageSitePage>
        }
      />
      <Route path="/brokerage/blog/:postSlug" element={<BrokeragePostPage />} />
      <Route
        path="/brokerage/listings"
        element={
          <BrokerageSitePage path="/brokerage/listings" pageTitle="Our Listings">
            <IdxListings isStandalonePage officeOnly />
          </BrokerageSitePage>
        }
      />
      <Route
        path="/brokerage/listings/:mlsNumber"
        element={
          <BrokerageSitePage path="/brokerage/listings" pageTitle="Listings">
            <IdxListingDetail />
          </BrokerageSitePage>
        }
      />
      <Route
        path="/brokerage/search"
        element={
          <BrokerageSitePage path="/brokerage/search" pageTitle="Home Search">
            <IdxListings isStandalonePage officeOnly={false} />
          </BrokerageSitePage>
        }
      />
      <Route
        path="/brokerage/home-valuation"
        element={
          <BrokerageSitePage path="/brokerage/home-valuation" pageTitle="Home Valuation">
            <HomeValuation isStandalonePage />
          </BrokerageSitePage>
        }
      />
      <Route
        path="/brokerage/contact"
        element={
          <BrokerageSitePage path="/brokerage/contact" pageTitle="Contact">
            <BrokerageContactCard isStandalonePage />
          </BrokerageSitePage>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <OrgProvider>
              <DashboardLayout />
            </OrgProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="listings" element={<ListingsTable />} />
        <Route path="listings/new" element={<NewListingPage />} />
        <Route path="listings/:id/edit" element={<EditListingPage />} />
        <Route path="listings/:id/flyer" element={<FlyerPage />} />
        <Route path="profile" element={<MyProfilePage />} />
        <Route path="site" element={<DashboardHome />} />
        <Route path="site/analytics" element={<MySitePage section="analytics" />} />
        <Route path="site/details" element={<MySitePage section="details" />} />
        <Route path="site/testimonials" element={<MySitePage section="testimonials" />} />
        <Route path="site/areas" element={<MySitePage section="areas" />} />
        <Route path="site/blog" element={<MySitePage section="blog" />} />
        <Route path="site/compare" element={<MySitePage section="compare" />} />
        <Route path="site/redirects" element={<MySitePage section="redirects" />} />
        <Route path="upcoming" element={<UpcomingModule />} />
        <Route path="settings" element={<PeopleGate />}>
          <Route index element={<SettingsPage />} />
        </Route>
        <Route path="people" element={<PeopleGate />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<PeopleOverview />} />
          <Route path="leads" element={<PeopleBoard group="lead" />} />
          <Route path="pipeline" element={<PeopleBoard group="pipeline" />} />
          <Route path="transactions" element={<PeopleBoard group="transaction" />} />
        </Route>
        {/* Old separate routes, now combined into one "Upcoming" tab —
            redirect rather than 404 in case either was already bookmarked. */}
        <Route path="upcoming-listings" element={<Navigate to="/dashboard/upcoming" replace />} />
        <Route path="buyer-needs" element={<Navigate to="/dashboard/upcoming" replace />} />
        <Route
          path="agents"
          element={
            <ProtectedRoute adminOnly>
              <AgentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="brand"
          element={
            <ProtectedRoute adminOnly>
              <BrandSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="organizations"
          element={
            <ProtectedRoute adminOnly platformOnly>
              <OrganizationsPage />
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
          path="sites/:agentId/:section?"
          element={
            <ProtectedRoute adminOnly>
              <EditAgentSitePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="brokerage-site"
          element={
            <ProtectedRoute adminOnly>
              <BrokerageSiteEditor />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
