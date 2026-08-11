import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import brokerage from "../../lib/brokerage";

// Landing page for the invite-email link (Supabase's inviteUserByEmail
// establishes a temporary session and redirects here). The agent sets
// their real password, then we send them into the dashboard.
export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
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
        <img src={brokerage.logo} alt={brokerage.name} className="h-14 w-auto mx-auto mb-8" />
        <div className="bg-white border border-black/5 rounded-2xl p-8 shadow-sm">
          <h1 className="text-xl font-display font-semibold mb-1 text-center">
            Welcome to The Agency
          </h1>
          <p className="text-sm text-[#1c1a17]/60 text-center mb-6">
            Set a password to finish creating your account
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#1c1a17]/60 mb-1.5">
                New password
              </label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1c1a17]/60 mb-1.5">
                Confirm password
              </label>
              <input
                required
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-[#1c1a17] text-white text-sm font-semibold py-3 hover:bg-[#1c1a17]/90 transition-colors disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Set Password & Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
