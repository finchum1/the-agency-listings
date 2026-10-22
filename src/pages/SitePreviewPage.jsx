import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAgentSite } from "../hooks/useAgentSite";
import TemplateCompare from "../components/TemplateCompare";
import AgentSitePage from "./AgentSitePage";
import { setPreviewBase } from "../lib/sitePreview";

// /preview/<token>/site/...: one page of the agent's site, drawn from a share link's data (drafts included) with the
// layout and colors in the address. Used as the frames inside the compare page, and for "Open full size".
export function PreviewSite({ pageTitle, children }) {
  const { token } = useParams();
  setPreviewBase(`/preview/${token}/site`); // before render, so every link on the page knows to stay inside the preview
  useEffect(() => () => setPreviewBase(null), []);
  const result = useAgentSite({ previewToken: token });
  return (
    <AgentSitePage {...result} pageTitle={pageTitle}>
      {children}
    </AgentSitePage>
  );
}

// /preview/<token>: the page an agent opens from a share link. No sign-in. Every layout, in their own content, and a button
// to say which they like best.
export default function SitePreviewPage() {
  const { token } = useParams();
  const { site, agent, loading, notFound } = useAgentSite({ previewToken: token });
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Pick your website look";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  if (loading) return <p className="min-h-screen grid place-items-center text-sm text-[#1c1a17]/50">Loading…</p>;
  if (notFound || !site) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center bg-[#f7f4ee] text-[#1c1a17]">
        <div>
          <h1 className="font-display text-2xl font-semibold">This link has expired</h1>
          <p className="mt-2 text-sm text-[#1c1a17]/60">Ask whoever sent it for a new one.</p>
        </div>
      </div>
    );
  }

  const first = (agent?.full_name || "").split(" ")[0];
  const pick = async (layout, theme) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/site-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, layout, theme }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "That didn't save. Try again.");
      setPicked({ layout, theme });
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee] dark:bg-[#111] text-[#1c1a17] dark:text-[#faf9f7] font-agent-sans">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold">{first ? `${first}, pick your website look` : "Pick your website look"}</h1>
        <p className="mt-3 max-w-2xl text-[#1c1a17]/65 dark:text-[#faf9f7]/65">
          Here is your website in five different layouts, using your own photo, bio, and listings. Scroll inside any preview to look around, or open it full size. Choose a color theme
          above the previews, then press the button on the one you like best. Nothing is final: you can change your mind later.
        </p>
        {picked && (
          <p role="status" className="mt-5 rounded-xl border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Thank you! We've been told which one you picked. You can still look around and pick a different one.
          </p>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-8">
          <TemplateCompare
            buildUrl={(layout, theme) => `/preview/${token}/site?preview_layout=${layout}&preview_theme=${theme}`}
            current={{ layout: null, theme: site.theme }}
            action={{ label: "I like this one", onPick: pick, busy, pickedLayout: picked?.layout }}
          />
        </div>
      </div>
    </div>
  );
}
