import { HttpError } from "./util.js";

// The office-level functions in this folder (agents, sites, blog, listings, people, deals) check the scope they need before they run. The AI connection
// tools build the context they are handed (api/_lib/mcpAct.js), so all that is left of the old token sign-in is this check.
export function requireScope(ctx, scope) {
  if (!ctx.scopes.includes(scope)) throw new HttpError(403, `This connection doesn't have the "${scope}" permission.`, { scopes: ctx.scopes, needed: scope });
}
