import { useListing } from "../hooks/useListing";
import ListingSitePage from "./ListingSitePage";

// Rendered at "/" whenever the request's hostname isn't a recognized app
// host (see lib/appHosts.js) — i.e. a visitor arrived via a listing's own
// attached custom domain (e.g. 1645SaratogaWay.com) rather than
// /listings/:slug. Looked up by listings.custom_domain instead of slug.
export default function CustomDomainListingPage() {
  const result = useListing({ customDomain: window.location.hostname });
  return <ListingSitePage {...result} />;
}
