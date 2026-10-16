import { useEffect } from "react";
import { Link } from "react-router-dom";
import { applyPageMeta } from "../lib/pageMeta";

// Public pages Google's OAuth consent screen requires: an application home page, a privacy policy and terms of
// service, all on the latchpointstudios.com domain (served at app.latchpointstudios.com/about, /privacy, /terms).
// Plain on purpose: these are read by people deciding whether to connect a Google account, and by Google's reviewers.

const APP = "The Agency Dashboard";
const OPERATOR = "Latchpoint Studios";
const CONTACT = "terrence@latchpointstudios.com";
const UPDATED = "October 15, 2026";

const PAGES = [
  { path: "/about", label: "About" },
  { path: "/privacy", label: "Privacy Policy" },
  { path: "/terms", label: "Terms of Service" },
];

function Shell({ title, description, path, children }) {
  useEffect(() => {
    applyPageMeta({ title: `${title} | ${APP}`, description });
  }, [title, description]);
  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#1c1a17]">
      <header className="border-b border-[#1c1a17]/10 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <Link to="/about" className="font-display text-lg font-semibold">
            {APP}
          </Link>
          <nav className="flex gap-5 text-sm">
            {PAGES.map((p) => (
              <Link key={p.path} to={p.path} className={path === p.path ? "font-semibold underline underline-offset-4" : "text-[#1c1a17]/70 hover:text-[#1c1a17]"}>
                {p.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 [&_h1]:font-display [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:leading-relaxed [&_p]:text-[#1c1a17]/80 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-2 [&_ul]:text-[#1c1a17]/80 [&_li]:leading-relaxed [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </main>
      <footer className="border-t border-[#1c1a17]/10">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-[#1c1a17]/55 flex flex-wrap justify-between gap-2">
          <span>
            {APP} is built and operated by <a href="https://latchpointstudios.com">{OPERATOR}</a>.
          </span>
          <span>
            <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> · <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
          </span>
        </div>
      </footer>
    </div>
  );
}

export function AboutPage() {
  return (
    <Shell title="About" path="/about" description={`${APP} is a dashboard for real estate agents: websites, leads, pipeline, transactions, and a schedule that syncs with Google Calendar.`}>
      <h1>{APP}</h1>
      <p>
        {APP} is a web application for real estate brokerages and agents. It brings an agent's website and blog, leads, pipeline, transactions, tasks, and
        daily schedule into one place, so an agent can start the day from a single page.
      </p>

      <h2>What it does</h2>
      <ul>
        <li>Agent and brokerage websites, property sites, and a blog, managed from the dashboard.</li>
        <li>A People area for leads, a pipeline, and transactions, with follow-up reminders and closing checklists.</li>
        <li>A home page with new inquiries, tasks, a closings and commission scorecard, and a schedule in Day, Week, and Month views.</li>
      </ul>

      <h2>Google Calendar</h2>
      <p>
        An agent can choose to connect their Google account so the schedule on their dashboard home page shows the calendars they pick, and so they can add,
        change, and delete events on those calendars without leaving the dashboard. Connecting is optional, the agent chooses which calendars to show, and the
        connection can be removed at any time from the dashboard or from their Google Account settings.
      </p>
      <p>
        The app asks Google for the minimum access this needs: the agent's email address (to label the connection), the list of their calendars, and the
        events on them. How that information is used and protected is described in the <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Who it is for</h2>
      <p>
        {APP} is used by real estate professionals who have been given an account. Accounts are created by invitation from an administrator at the agent's
        brokerage, and there is no public sign-up.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Read the <Link to="/privacy">Privacy Policy</Link> and the{" "}
        <Link to="/terms">Terms of Service</Link>.
      </p>
    </Shell>
  );
}

export function PrivacyPage() {
  return (
    <Shell title="Privacy Policy" path="/privacy" description={`How ${APP} collects, uses, stores, and protects information, including data from Google Calendar.`}>
      <h1>Privacy Policy</h1>
      <p className="!text-[#1c1a17]/55 text-sm">Last updated {UPDATED}</p>
      <p>
        {APP} ("the app", "we") is operated by {OPERATOR}. This policy explains what information the app handles, what we do with it, and the choices you
        have. It covers the dashboard used by agents and brokerage staff, and the optional connection to Google Calendar.
      </p>

      <h2>Information we handle</h2>
      <ul>
        <li>
          <strong>Account information:</strong> your name, email address, and the brokerage you belong to, used to sign you in and show the right workspace.
        </li>
        <li>
          <strong>Information you enter:</strong> website content, blog posts, leads, pipeline and transaction records, tasks, and goals. This belongs to you
          and your brokerage.
        </li>
        <li>
          <strong>Inquiries sent through agent websites:</strong> the name, email, phone number, and message a visitor submits, delivered to the agent they
          wrote to.
        </li>
        <li>
          <strong>Google account information</strong>, only if you choose to connect Google Calendar. Described below.
        </li>
      </ul>

      <h2>Google user data</h2>
      <p>If you connect your Google account, the app requests these permissions, and nothing broader:</p>
      <ul>
        <li>
          <strong>Your email address and basic sign-in identity</strong> (openid, email): to show which Google account is connected.
        </li>
        <li>
          <strong>The list of your calendars</strong> (calendar.calendarlist.readonly): so you can choose which calendars appear on your dashboard. We read each
          calendar's name, color, and whether you can edit it.
        </li>
        <li>
          <strong>Events on your calendars</strong> (calendar.events): to show your events (title, time, location, and description) on your dashboard schedule,
          and to create, change, or delete events when you ask the app to.
        </li>
      </ul>

      <h2>How we use Google user data</h2>
      <p>
        Google data is used only to provide the calendar features you see in the app: displaying your schedule and carrying out the event changes you make.
        We do not use it for advertising, we do not sell it, we do not use it to train artificial intelligence or machine learning models, and we do not let
        people read it except as described below.
      </p>
      <p>
        Events are fetched from Google when you open your schedule and shown to you. We do not keep a copy of your events in our database. What we store is:
        your connected Google email address, which calendars you chose to show, and an encrypted refresh token that lets the app keep reading your chosen
        calendars without asking you to sign in again each time.
      </p>
      <p>
        The refresh token is encrypted before it is stored, is held in a table that no user and no part of the app's browser code can read, and is used only
        by the app's servers when they call Google on your behalf. Only you can see which accounts you have connected.
      </p>
      <p>
        We share Google data with no one. The only people who can see your events are you and anyone you have shared those calendars with in Google. Our
        service providers (below) process data only to run the app. We would disclose data only if the law requires it, or with your consent.
      </p>

      <h2>Google API Services User Data Policy</h2>
      <p>
        {APP}'s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Disconnecting and deleting your data</h2>
      <ul>
        <li>
          <strong>Disconnect Google at any time</strong> from the calendar settings on your dashboard home page. This deletes the stored token and the list of
          calendars you linked, and the app can no longer reach your Google account.
        </li>
        <li>
          <strong>Or revoke access from Google</strong> at{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            myaccount.google.com/permissions
          </a>
          . The app notices and asks you to reconnect if you want to use it again.
        </li>
        <li>
          <strong>Delete everything:</strong> email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the address on your account and we will delete your
          account and the data tied to it, subject to what your brokerage must keep for its own records.
        </li>
      </ul>

      <h2>Where information is stored and who processes it</h2>
      <p>
        The app runs on Vercel (hosting) and stores data with Supabase (database and file storage). Email notifications, such as a confirmation to someone who
        submits an inquiry, are sent through Resend. These providers process information only to operate the app for us. Data is encrypted in transit, and
        access to each person's records is limited to that person and the people at their brokerage who are authorized to see them.
      </p>

      <h2>Retention</h2>
      <p>
        We keep account and workspace information while the account is active. Google connection data is deleted as soon as you disconnect. When an account is
        deleted, the data tied to it is removed from active systems, and routine backups expire on the provider's normal schedule.
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        The app uses browser storage to keep you signed in and remember preferences such as light or dark mode. It does not use advertising cookies.
      </p>

      <h2>Children</h2>
      <p>The app is for real estate professionals and is not directed to children under 13. We do not knowingly collect their information.</p>

      <h2>Changes to this policy</h2>
      <p>
        If we change this policy, we will update the date above. If a change affects how Google data is used, we will tell connected users before it takes
        effect.
      </p>

      <h2>Contact</h2>
      <p>
        {OPERATOR}, Oklahoma, USA. <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </Shell>
  );
}

export function TermsPage() {
  return (
    <Shell title="Terms of Service" path="/terms" description={`The terms for using ${APP}.`}>
      <h1>Terms of Service</h1>
      <p className="!text-[#1c1a17]/55 text-sm">Last updated {UPDATED}</p>
      <p>
        These terms apply to your use of {APP} ("the app"), operated by {OPERATOR} ("we"). By signing in or connecting a Google account, you agree to them. If
        you do not agree, do not use the app.
      </p>

      <h2>Accounts</h2>
      <p>
        Accounts are created by invitation. You are responsible for keeping your sign-in details private and for activity under your account. Tell us promptly
        if you think someone else has access. The information you give us must be accurate.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Use the app only for lawful real estate business, and follow the rules that apply to you, including fair housing, anti-spam, and privacy laws.</li>
        <li>Do not attempt to access other people's data, interfere with the app's operation, or probe it for weaknesses without our written permission.</li>
        <li>Do not upload content you have no right to use, or that is unlawful, deceptive, or infringing.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You and your brokerage keep ownership of what you enter: website content, posts, photos, leads, and transaction records. You give us permission to
        store, process, and display it as needed to run the app for you, including publishing the websites and posts you choose to publish.
      </p>

      <h2>Google Calendar connection</h2>
      <p>
        Connecting Google Calendar is optional. When you connect, you authorize the app to read the calendars you choose and to create, change, and delete events
        on them at your request, as described in the <Link to="/privacy">Privacy Policy</Link>. Changes you make in the app change your real Google Calendar,
        including deletions. You can disconnect at any time from the dashboard or from your Google Account. Your use of Google's services stays subject to
        Google's own terms.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We work to keep the app available and accurate, but it is provided as is, and we do not promise it will be uninterrupted or error free. Features may
        change, and we may suspend access that breaks these terms or puts the app or other users at risk.
      </p>

      <h2>Disclaimer and limits on liability</h2>
      <p>
        The app is a business tool and does not give legal, tax, or financial advice. Check important dates, documents, and figures yourself. To the fullest
        extent the law allows, we are not liable for indirect or consequential losses, or for lost deals, commissions, or data, and our total liability for any
        claim is limited to the amount you paid us for the app in the twelve months before the claim. Nothing here limits liability that cannot be limited by
        law.
      </p>

      <h2>Ending your use</h2>
      <p>
        You may stop using the app at any time. We may end or suspend an account that violates these terms. On request we will delete your account as described
        in the <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Changes and governing law</h2>
      <p>
        We may update these terms and will change the date above when we do. Continued use after a change means you accept it. These terms are governed by
        the laws of the State of Oklahoma.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </Shell>
  );
}
