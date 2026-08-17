import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import brokerage from "../../lib/brokerage";

// Sign-in only — there's no public sign-up here. Accounts are created by an
// admin inviting an agent (see AgentsPage.jsx), which emails an invite link
// that lands on SetPasswordPage.jsx.
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={brokerage.logo} alt={brokerage.name} className="h-14 w-auto" />
          <span className="h-9 w-px bg-black/10" aria-hidden="true" />
          <span className="text-xs font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50">
            Oklahoma
          </span>
        </div>
        <div className="bg-white border border-black/5 rounded-2xl p-8 shadow-sm">
          <h1 className="text-xl font-display font-semibold mb-1 text-center">
            Dashboard
          </h1>
          <p className="text-sm text-[#1c1a17]/60 text-center mb-6">
            Sign in with your agent account
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
                className="w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40"
                placeholder="you@theagencyre.com"
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
                className="w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40"
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
      </div>
    </div>
  );
}
