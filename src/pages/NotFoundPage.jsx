import { Link } from "react-router-dom";
import brokerage from "../lib/brokerage";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf9f7] px-6 text-center">
      <img src={brokerage.logo} alt={brokerage.name} className="h-14 w-auto mb-8" />
      <h1 className="text-3xl font-display font-semibold mb-3">Page not found</h1>
      <p className="text-[#1c1a17]/60 mb-8 max-w-sm">
        This listing may have been unpublished or the link is incorrect.
      </p>
      <Link
        to="/"
        className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-6 py-3 hover:bg-[#1c1a17]/90 transition-colors"
      >
        Go home
      </Link>
    </div>
  );
}
