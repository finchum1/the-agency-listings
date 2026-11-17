import { Check, PhoneCall } from "@phosphor-icons/react";
import WalkingProcess from "./WalkingProcess";
import "./process-preview.css";

// "How it works" on the Agency page: the node walks the three steps while a small dashboard beside them fills in. First
// the conversation about your day, then the build ticking along, then the finished thing, where editing is a form.

const STEPS = [
  {
    marker: "01",
    title: "We talk through your day",
    body: "Where leads come from, what stages your pipeline has, what happens between contract and closing. The back office gets shaped to that, not the other way around.",
    caption: "The conversation",
  },
  {
    marker: "02",
    title: "We build and move you over",
    body: "Your site, your dashboard, and your old blog posts. Old URLs are redirected to the new ones so the search ranking you've earned comes with you.",
    caption: "The build",
  },
  {
    marker: "03",
    title: "You run it, we keep it healthy",
    body: "Edits are forms, not code. And when you want something added later, you have a studio to call instead of a ticket queue.",
    caption: "Live",
  },
];

const QUESTIONS = [
  { q: "Where do your leads come from?", a: ["Zillow", "Referrals", "Open houses", "Your website"] },
  { q: "What stages does your pipeline have?", a: ["New", "Contacted", "Nurturing", "Qualified"] },
  { q: "What happens between contract and closing?", a: ["Inspection", "Appraisal", "Loan", "Title", "Walk-through"] },
];

const BUILD = [
  "Your website, built and live on your own domain",
  "Your blog posts, moved over",
  "Old URLs redirected, so your search ranking comes with you",
  "Your dashboard, with your logo and colors",
];

export default function AgencyProcess() {
  return (
    <WalkingProcess
      steps={STEPS}
      preview={(stage) => (
        <div className="rp" data-stage={stage} aria-hidden="true">
          <div className="rp-card">
            <div className="rp-head">
              <div>
                <p className="rp-name">Jordan Reyes</p>
                <p className="rp-sub">Your Agency website and dashboard</p>
              </div>
              <span className="rp-status">
                <span data-for="0">Talking it through</span>
                <span data-for="1">Building</span>
                <span data-for="2">Live</span>
              </span>
            </div>

            {/* step 1: the conversation */}
            <div className="rp-talk">
              <p className="rp-eyebrow">What we talk through</p>
              <ul>
                {QUESTIONS.map((x, i) => (
                  <li key={x.q} style={{ "--i": i }}>
                    <p>{x.q}</p>
                    <span className="rp-chips">
                      {x.a.map((a) => (
                        <em key={a}>{a}</em>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* step 2: the build */}
            <div className="rp-build">
              <p className="rp-eyebrow">Being built</p>
              <ul>
                {BUILD.map((b, i) => (
                  <li key={b} style={{ "--i": i }}>
                    <span className="rp-tick">
                      <Check weight="bold" />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
              <div className="rp-meter">
                <span />
              </div>
            </div>

            {/* step 3: running it */}
            <div className="rp-run">
              <p className="rp-eyebrow">Editing is a form</p>
              <div className="rp-form">
                <label>
                  Listing price
                  <span className="rp-field">$425,000</span>
                </label>
                <label>
                  Status
                  <span className="rp-seg">
                    <em>Active</em>
                    <em data-on="true">Under contract</em>
                    <em>Sold</em>
                  </span>
                </label>
                <span className="rp-save">
                  <Check weight="bold" /> Saved. It&rsquo;s on your site.
                </span>
              </div>
              <p className="rp-studio">
                <PhoneCall weight="bold" /> A studio to call when you want something changed.
              </p>
            </div>
          </div>
          <p className="rp-caption">
            <span>{String(stage + 1).padStart(2, "0")}</span> {STEPS[stage].caption}
          </p>
        </div>
      )}
    />
  );
}
