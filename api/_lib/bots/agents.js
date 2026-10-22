import { randomUUID } from "node:crypto";
import { HttpError, bad, isUuid, oneOf, text, url } from "./util.js";
import { requireScope } from "./context.js";
import { createSite } from "./sites.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const view = (p, siteBy) => ({
  id: p.id,
  full_name: p.full_name,
  email: p.email,
  title: p.title,
  license: p.license,
  phone: p.phone,
  role: p.role,
  login_enabled: p.login_enabled,
  site_access: p.site_access,
  people_enabled: p.people_enabled,
  site_id: siteBy.get(p.id) || null,
});

export async function listAgents(ctx) {
  const [{ data: people, error }, { data: sites }] = await Promise.all([
    ctx.client.from("profiles").select("id, full_name, email, title, license, phone, role, login_enabled, site_access, people_enabled").eq("org_id", ctx.orgId).order("full_name"),
    ctx.client.from("agent_sites").select("id, agent_id").eq("org_id", ctx.orgId),
  ]);
  if (error) throw new HttpError(500, error.message);
  const siteBy = new Map((sites || []).map((s) => [s.agent_id, s.id]));
  return { agents: (people || []).map((p) => view(p, siteBy)) };
}

export async function getAgent(ctx, id) {
  if (!isUuid(id)) throw bad("That isn't a valid agent id.");
  const { data: p } = await ctx.client.from("profiles").select("id, full_name, email, title, license, phone, role, login_enabled, site_access, people_enabled").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (!p) throw new HttpError(404, "No agent with that id in your organization.");
  const { data: s } = await ctx.client.from("agent_sites").select("id").eq("agent_id", id).maybeSingle();
  return { agent: view(p, new Map(s ? [[id, s.id]] : [])) };
}

// Creates a new agent in the caller's organization. By default it is a profile only (no email goes out and nobody can log
// in until you enable it), the same as "Add agent" without "send invite". The role is always "agent": a bot can't make admins.
export async function createAgent(ctx, body, req) {
  requireScope(ctx, "agents");
  const email = text(body, "email", { required: true, max: 200 }).toLowerCase();
  if (!EMAIL.test(email)) throw bad("email isn't a valid email address.");
  const full_name = text(body, "full_name", { required: true, max: 120 });
  const title = text(body, "title", { max: 80 });
  const license = text(body, "license", { max: 60 });
  const phone = text(body, "phone", { max: 40 });
  const photo_url = url(body, "photo_url");
  const site_access = oneOf(body, "site_access", ["full", "limited", "none"]) || "full";
  const sendInvite = body.send_invite === true;
  const people_enabled = body.people_enabled === true;
  if (body.site !== undefined && (typeof body.site !== "object" || Array.isArray(body.site) || body.site === null)) throw bad("site must be an object (the fields for the agent's website).");

  const { data: existing } = await ctx.admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (existing) throw new HttpError(409, "An agent with that email already exists.", { agent_id: existing.id });

  const metadata = { full_name };
  let userId;
  if (sendInvite) {
    const { data, error } = await ctx.admin.auth.admin.inviteUserByEmail(email, { data: metadata, redirectTo: `https://${req.headers.host}/accept-invite` });
    if (error) throw bad(error.message);
    userId = data.user.id;
  } else {
    const { data, error } = await ctx.admin.auth.admin.createUser({ email, password: randomUUID() + randomUUID(), email_confirm: true, user_metadata: metadata });
    if (error) throw bad(error.message);
    userId = data.user.id;
  }

  const { error: updateError } = await ctx.admin
    .from("profiles")
    .update({ org_id: ctx.orgId, role: "agent", login_enabled: sendInvite, title, license, phone, photo_url: photo_url || null, site_access, people_enabled })
    .eq("id", userId);
  const result = { agent_id: userId, email, full_name, invited: sendInvite, ...(updateError ? { warning: "The agent was created, but some details didn't save. Review them in Agents." } : {}) };

  // Optionally build their website in the same call (a draft unless the site object says otherwise).
  if (body.site) {
    requireScope(ctx, "sites");
    try {
      result.site = await createSite(ctx, { ...body.site, agent_id: userId }, req);
    } catch (err) {
      result.site_error = err.message;
    }
  }
  return result;
}
