import { useNavigate } from "react-router-dom";
import ListingForm from "./ListingForm";

export default function NewListingPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-display font-semibold mb-6">New Listing</h1>
      <ListingForm
        mode="create"
        onSaved={(id) => navigate(`/dashboard/listings/${id}/edit`, { replace: true })}
      />
    </div>
  );
}
