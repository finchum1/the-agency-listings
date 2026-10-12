import { useParams, useSearchParams } from "react-router-dom";
import { safeFromPath } from "../lib/backLink";
import { useListing } from "../hooks/useListing";
import ListingSitePage from "./ListingSitePage";

export default function PublicListingPage() {
  const { slug } = useParams();
  const result = useListing({ slug });
  const [searchParams] = useSearchParams();
  const from = safeFromPath(searchParams.get("from"));
  return <ListingSitePage {...result} backLink={from ? { href: from, label: "Back to website" } : undefined} />;
}
