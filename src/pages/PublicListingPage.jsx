import { useParams } from "react-router-dom";
import { useListing } from "../hooks/useListing";
import ListingSitePage from "./ListingSitePage";

export default function PublicListingPage() {
  const { slug } = useParams();
  const result = useListing({ slug });
  return <ListingSitePage {...result} />;
}
