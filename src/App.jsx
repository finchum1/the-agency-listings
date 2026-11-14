import { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { OrgProvider } from "./context/OrgContext";
import { useHostOrg } from "./hooks/useHostOrg";
import { useHostBranding } from "./hooks/useHostBranding";
import { isAppHost, isDashboardOnlyHost, isMarketingHost } from "./lib/appHosts";
import useSwUpdateOnNavigate from "./hooks/useSwUpdateOnNavigate";
import { isStandalone } from "./lib/pwa";
import { lazyPage } from "./lib/lazyPage";
import PageFallback from "./components/PageFallback";

const LoginPage = lazyPage(() => import("./components/auth/LoginPage"));
const OAuthAuthorizePage = lazyPage(() => import("./pages/OAuthAuthorizePage"));
const SetPasswordPage = lazyPage(() => import("./components/auth/SetPasswordPage"));
import ProtectedRoute from "./components/ProtectedRoute";
const DashboardLayout = lazyPage(() => import("./components/dashboard/DashboardLayout"));
const ListingsTable = lazyPage(() => import("./components/dashboard/ListingsTable"));
const NewListingPage = lazyPage(() => import("./components/dashboard/NewListingPage"));
const EditListingPage = lazyPage(() => import("./components/dashboard/EditListingPage"));
const SocialPostPage = lazyPage(() => import("./components/dashboard/SocialPostPage"));
const MarketingHome = lazyPage(() => import("./components/dashboard/MarketingHome"));
const HolidayPostPage = lazyPage(() => import("./components/dashboard/HolidayPostPage"));
const FlyerPage = lazyPage(() => import("./components/dashboard/FlyerPage"));
const AgentsPage = lazyPage(() => import("./components/dashboard/AgentsPage"));
const UpcomingModule = lazyPage(() => import("./components/dashboard/UpcomingModule"));
const VendorsPage = lazyPage(() => import("./components/dashboard/VendorsPage"));
const ListingAnalyticsPage = lazyPage(() => import("./components/dashboard/ListingAnalyticsPage"));
const OfficeAnalyticsPage = lazyPage(() => import("./components/dashboard/OfficeAnalyticsPage"));
const ContactsPage = lazyPage(() => import("./components/dashboard/people/contacts/ContactsPage"));
const DealsGate = lazyPage(() => import("./components/dashboard/people/DealsGate"));
const DealsPage = lazyPage(() => import("./components/dashboard/people/DealsPage"));
const ListingReportPage = lazyPage(() => import("./pages/ListingReportPage"));
const TransactionTimelinePage = lazyPage(() => import("./pages/TransactionTimelinePage"));
const AgentUpdatePage = lazyPage(() => import("./pages/AgentUpdatePage"));
const SellersPage = lazyPage(() => import("./components/agent-site/landing/SellersPage"));
const SoldHomes = lazyPage(() => import("./components/agent-site/SoldHomes"));
const BuyersPage = lazyPage(() => import("./components/agent-site/landing/BuyersPage"));
const HomeValuePage = lazyPage(() => import("./components/agent-site/landing/HomeValuePage"));
const RelocationPage = lazyPage(() => import("./components/agent-site/landing/RelocationPage"));
const VendorSharePage = lazyPage(() => import("./pages/VendorSharePage"));
const MyProfilePage = lazyPage(() => import("./components/dashboard/MyProfilePage"));
const MySitePage = lazyPage(() => import("./components/dashboard/MySitePage"));
const DashboardHome = lazyPage(() => import("./components/dashboard/DashboardHome"));
const SitesPage = lazyPage(() => import("./components/dashboard/SitesPage"));
const EditAgentSitePage = lazyPage(() => import("./components/dashboard/EditAgentSitePage"));
const PublicListingPage = lazyPage(() => import("./pages/PublicListingPage"));
const CustomDomainSitePage = lazyPage(() => import("./pages/CustomDomainSitePage"));
const PublicAgentSitePage = lazyPage(() => import("./pages/PublicAgentSitePage"));
const PublicAgentPostPage = lazyPage(() => import("./pages/PublicAgentPostPage"));
const PublicAgentAreaPage = lazyPage(() => import("./pages/PublicAgentAreaPage"));
const SitePreviewPage = lazyPage(() => import("./pages/SitePreviewPage"));
const PreviewSite = lazyPage(() => import("./pages/SitePreviewPage").then((m) => ({ default: m.PreviewSite })));
const NotFoundPage = lazyPage(() => import("./pages/NotFoundPage"));
const AboutPage = lazyPage(() => import("./pages/LegalPages").then((m) => ({ default: m.AboutPage })));
const PrivacyPage = lazyPage(() => import("./pages/LegalPages").then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazyPage(() => import("./pages/LegalPages").then((m) => ({ default: m.TermsPage })));
const LandingPage = lazyPage(() => import("./pages/LandingPage"));
const AgentWebsitesPage = lazyPage(() => import("./pages/AgentWebsitesPage"));
const PropertyWebsitesPage = lazyPage(() => import("./pages/PropertyWebsitesPage"));
const UpcomingPage = lazyPage(() => import("./pages/UpcomingPage"));
const PeoplePage = lazyPage(() => import("./pages/PeoplePage"));
const BrokerageWebsitePage = lazyPage(() => import("./pages/BrokerageWebsitePage"));
const BrokerageSitePage = lazyPage(() => import("./pages/BrokerageSitePage"));
const BrokeragePostPage = lazyPage(() => import("./pages/BrokeragePostPage"));
const BrokerageAreaPage = lazyPage(() => import("./pages/BrokerageAreaPage"));
const BrokerageSiteEditor = lazyPage(() => import("./components/dashboard/BrokerageSiteEditor"));
const PeopleGate = lazyPage(() => import("./components/dashboard/people/PeopleGate"));
const ProspectsPage = lazyPage(() => import("./components/dashboard/people/ProspectsPage"));
const PeopleLayout = lazyPage(() => import("./components/dashboard/people/PeopleLayout"));
const PlansPage = lazyPage(() => import("./components/dashboard/people/PlansPage"));
const PeopleOverview = lazyPage(() => import("./components/dashboard/people/PeopleOverview"));
const SettingsPage = lazyPage(() => import("./components/dashboard/people/SettingsPage"));
const BrandSettingsPage = lazyPage(() => import("./components/dashboard/BrandSettingsPage"));
const OrganizationsPage = lazyPage(() => import("./components/dashboard/OrganizationsPage"));
const AreaTemplatesPage = lazyPage(() => import("./components/dashboard/AreaTemplatesPage"));

const HomeSections = lazyPage(() => import("./components/agent-site/HomeSections"));
const Bio = lazyPage(() => import("./components/agent-site/Bio"));
const Testimonials = lazyPage(() => import("./components/agent-site/Testimonials"));
const FeaturedListings = lazyPage(() => import("./components/agent-site/FeaturedListings"));
const ServiceAreas = lazyPage(() => import("./components/agent-site/ServiceAreas"));
const BlogTeaser = lazyPage(() => import("./components/agent-site/BlogTeaser"));
const Contact = lazyPage(() => import("./components/agent-site/Contact"));

const BrokerageHomeSections = lazyPage(() => import("./components/brokerage-site/HomeSections"));
const BrokerageAbout = lazyPage(() => import("./components/brokerage-site/About"));
const BrokerageAgentRoster = lazyPage(() => import("./components/brokerage-site/AgentRoster"));
const BrokerageAreasOfExpertise = lazyPage(() => import("./components/brokerage-site/AreasOfExpertise"));
const BrokerageBlogList = lazyPage(() => import("./components/brokerage-site/BlogList"));
const BrokerageContactCard = lazyPage(() => import("./components/brokerage-site/ContactCard"));
const IdxListings = lazyPage(() => import("./components/brokerage-site/IdxListings"));
const IdxListingDetail = lazyPage(() => import("./components/brokerage-site/IdxListingDetail"));
const HomeValuation = lazyPage(() => import("./components/brokerage-site/HomeValuation"));

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

function AppRoutes() {
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
      <Route path="/oauth/authorize" element={<OAuthAuthorizePage />} />
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
      <Route path="/sites/:slug/past-sales" element={<PublicAgentSitePage pageTitle="Past Sales"><SoldHomes page /></PublicAgentSitePage>} />
      <Route path="/sites/:slug/sellers" element={<PublicAgentSitePage pageTitle="Sellers"><SellersPage /></PublicAgentSitePage>} />
      <Route path="/sites/:slug/buyers" element={<PublicAgentSitePage pageTitle="Buyers"><BuyersPage /></PublicAgentSitePage>} />
      <Route path="/sites/:slug/home-value" element={<PublicAgentSitePage pageTitle="Home Value"><HomeValuePage /></PublicAgentSitePage>} />
      <Route path="/sites/:slug/relocation" element={<PublicAgentSitePage pageTitle="Relocation"><RelocationPage /></PublicAgentSitePage>} />
      <Route path="/sites/:slug/blog/:postSlug" element={<PublicAgentPostPage />} />

      {/* Template comparison share links: no sign-in, the token in the address is the credential. /preview/:token is the
          page the agent opens; the /site routes are the frames inside it (and "Open full size"). */}
      <Route path="/preview/:token" element={<SitePreviewPage />} />
      {/* A client's private list of recommended vendors: no sign-in, the token in the address is the credential. */}
      <Route path="/vendors/:token" element={<VendorSharePage />} />
      {/* A seller's private activity report for one listing: same idea, token in the address. */}
      <Route path="/report/:token" element={<ListingReportPage />} />
      {/* A buyer's or seller's private closing timeline. */}
      <Route path="/timeline/:token" element={<TransactionTimelinePage />} />
      {/* A coordinator's update on one deal, for the agent who owns it: same idea, token in the address. */}
      <Route path="/update/:token" element={<AgentUpdatePage />} />
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
        path="/preview/:token/site/past-sales"
        element={
          <PreviewSite pageTitle="Past Sales">
            <SoldHomes page />
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
        <Route path="listings/:id/social" element={<SocialPostPage />} />
        <Route path="marketing" element={<MarketingHome />} />
        <Route path="marketing/holiday" element={<HolidayPostPage />} />
        <Route path="listings/:id/analytics" element={<ListingAnalyticsPage />} />
        <Route path="profile" element={<MyProfilePage />} />
        <Route path="site" element={<DashboardHome />} />
        <Route path="site/content" element={<MySitePage section="content" />} />
        <Route path="site/design" element={<MySitePage section="design" />} />
        <Route path="site/settings" element={<MySitePage section="settings" />} />
        <Route path="site/insights" element={<MySitePage section="insights" />} />
        <Route path="site/analytics" element={<MySitePage section="analytics" />} />
        <Route path="site/details" element={<MySitePage section="details" />} />
        <Route path="site/testimonials" element={<MySitePage section="testimonials" />} />
        <Route path="site/areas" element={<MySitePage section="areas" />} />
        <Route path="site/listings" element={<MySitePage section="listings" />} />
        <Route path="site/sales" element={<MySitePage section="sales" />} />
        <Route path="site/blog" element={<MySitePage section="blog" />} />
        <Route path="site/compare" element={<MySitePage section="compare" />} />
        <Route path="site/redirects" element={<MySitePage section="redirects" />} />
        <Route path="upcoming" element={<UpcomingModule />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="settings" element={<PeopleGate />}>
          <Route element={<PeopleLayout />}>
            <Route index element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="people" element={<PeopleGate />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route element={<PeopleLayout />}>
            <Route path="overview" element={<PeopleOverview />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="leads" element={<ProspectsPage group="lead" />} />
            <Route path="pipeline" element={<ProspectsPage group="pipeline" />} />
            <Route path="plans" element={<PlansPage />} />
          </Route>
          <Route path="transactions" element={<Navigate to="/dashboard/deals" replace />} />
        </Route>
        <Route path="deals" element={<DealsGate />}>
          <Route index element={<DealsPage key="overview" page="overview" />} />
          <Route path="board" element={<DealsPage key="board" page="board" />} />
        </Route>
        {/* Old separate routes, now combined into one "Upcoming" tab —
            redirect rather than 404 in case either was already bookmarked. */}
        <Route path="upcoming-listings" element={<Navigate to="/dashboard/upcoming" replace />} />
        <Route path="buyer-needs" element={<Navigate to="/dashboard/upcoming" replace />} />
        <Route
          path="office-analytics"
          element={
            <ProtectedRoute adminOnly>
              <OfficeAnalyticsPage />
            </ProtectedRoute>
          }
        />
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
          path="area-templates"
          element={
            <ProtectedRoute adminOnly>
              <AreaTemplatesPage />
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
          path="brokerage-site/:section?"
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

// Every page loads on demand (lazyPage), so the first visit downloads only the page it lands on instead of the whole app.
export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <AppRoutes />
    </Suspense>
  );
}
