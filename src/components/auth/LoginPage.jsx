import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuthOrg, rememberLoginOrg } from "../../hooks/useAuthOrg";
import AuthBrand from "./AuthBrand";

// Sign-in only — there's no public sign-up here. Accounts are created by an
// admin inviting an agent (see AgentsPage.jsx), which emails an invite link
// that lands on SetPasswordPage.jsx.
export default function LoginPage() {
  const { org, loading: orgLoading } = useAuthOrg();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const platform = !orgLoading && !org; // no organization's brand to wear: this is the product's own sign-in

  useEffect(() => {
    if (platform) document.title = "Sign in | Latchpoint Real Estate";
  }, [platform]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Remember whose dashboard this browser signs in to, so the next visit shows their logo
    const { data: mine } = await supabase.from("profiles").select("org:organizations(slug)").eq("id", data.user.id).maybeSingle();
    rememberLoginOrg(mine?.org?.slug);
    // Sent here from another page that needs a sign-in (an AI app asking to connect): go back to it. Only a path on this site is followed.
    const next = new URLSearchParams(window.location.search).get("next");
    navigate(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-6">
      <div className="w-full max-w-sm">
        <AuthBrand org={org} loading={orgLoading} className="mb-8" />
        <div className="bg-white border border-black/5 rounded-2xl p-8 shadow-sm">
          <h1 className="text-xl font-display font-semibold mb-1 text-center">
            {platform ? "Welcome back" : "Dashboard"}
          </h1>
          <p className="text-sm text-[#1c1a17]/60 text-center mb-6">
            {platform ? "Sign in to Latchpoint Real Estate" : "Sign in with your agent account"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#1c1a17]/60 mb-1.5">
                Email
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-(--lp-ember)/40"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1c1a17]/60 mb-1.5">
                Password
              </label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-(--lp-ember)/40"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-[#1c1a17] text-white text-sm font-semibold py-3 hover:bg-[#1c1a17]/90 transition-colors disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
        <p className="text-xs text-center text-[#1c1a17]/40 mt-6">
          Don't have an account? Ask your admin to invite you.
        </p>
        <p className="text-xs text-center text-[#1c1a17]/40 mt-2">
          <Link to="/privacy" className="hover:text-[#1c1a17]/70 underline underline-offset-2">Privacy</Link>
          {" · "}
          <Link to="/terms" className="hover:text-[#1c1a17]/70 underline underline-offset-2">Terms</Link>
        </p>
      </div>
    </div>
  );
}
