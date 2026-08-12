import { createContext, useContext } from "react";

const AgentSiteContext = createContext(null);

// value: { site, siteId } — `site` is the adaptAgentSite() shape.
export function AgentSiteProvider({ value, children }) {
  return <AgentSiteContext.Provider value={value}>{children}</AgentSiteContext.Provider>;
}

export function useAgentSiteContext() {
  const ctx = useContext(AgentSiteContext);
  if (!ctx) throw new Error("useAgentSiteContext must be used within an AgentSiteProvider");
  return ctx;
}
