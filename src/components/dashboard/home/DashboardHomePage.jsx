import { Link } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { useAgentTasks } from "../../../hooks/useAgentTasks";
import { useLeadAlerts } from "../../../hooks/useLeadAlerts";
import { usePeopleSummary } from "../../../hooks/usePeopleSummary";
import { toKey } from "../../../lib/homeDates";
import LeadAlertsCard from "./LeadAlertsCard";
import ScheduleCard from "./ScheduleCard";
import ScorecardCard from "./ScorecardCard";
import Shortcuts from "./Shortcuts";
import TasksCard from "./TasksCard";
import { muted } from "./styles";

// The page agents land on after signing in: a welcome, shortcuts, their schedule, new website inquiries, their own task
// list and (with People on) a closings scorecard. Each part only appears for what that agent's account has switched on.
export default function DashboardHomePage() {
  const { user, profile } = useAuth();
  const tasksApi = useAgentTasks(user?.id);

  const wantsBlog = (profile?.site_access || "full") !== "none";
  const wantsPeople = !!profile?.people_enabled;
  const peopleSummary = usePeopleSummary(wantsPeople);
  const { alerts, loading: alertsLoading, dismiss: dismissAlert } = useLeadAlerts(user?.id, wantsPeople);

  const first = (profile?.full_name || "").trim().split(/\s+/)[0];
  const now = new Date();
  const today = toKey(now);
  const dateLine = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const tasksDue = tasksApi.tasks.filter((t) => !t.done && t.due_date && t.due_date <= today).length;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const bits = [];
  if (peopleSummary?.dueNow > 0) bits.push(`${plural(peopleSummary.dueNow, "follow-up")} due today or overdue`);
  if (peopleSummary?.overdueTasks > 0) bits.push(`${plural(peopleSummary.overdueTasks, "overdue deal task")}`);
  if (tasksDue > 0) bits.push(`${plural(tasksDue, "task")} on your list due today or overdue`);
  const settled = !tasksApi.loading && (!wantsPeople || peopleSummary);
  const summary = !settled ? "Here's what's going on." : bits.length ? `You have ${bits.join(" and ")}.` : "You're all caught up.";

  return (
    <div className="max-w-6xl min-w-0 space-y-6">
      <header>
        <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${muted}`}>{dateLine}</p>
        <h1 className="text-3xl font-display font-semibold mt-1.5">{first ? `Welcome, ${first}` : "Welcome"}</h1>
        <p className="text-sm mt-1.5 text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
          {summary}
          {wantsPeople && (
            <>
              {" "}
              <Link to="/dashboard/people/overview" className="font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                Open People overview →
              </Link>
            </>
          )}
        </p>
      </header>

      <Shortcuts wantsBlog={wantsBlog} wantsPeople={wantsPeople} />

      <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-3 items-start">
        <ScheduleCard userId={user?.id} wantsPeople={wantsPeople} tasks={tasksApi.tasks} />
        <LeadAlertsCard alerts={alerts} loading={alertsLoading} peopleEnabled={wantsPeople} onDismiss={dismissAlert} />
      </div>

      <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-3 items-start">
        <TasksCard tasksApi={tasksApi} span={!wantsPeople} />
        {wantsPeople && <ScorecardCard userId={user?.id} />}
      </div>
    </div>
  );
}
