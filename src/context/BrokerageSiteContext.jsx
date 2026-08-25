import { createContext, useContext } from "react";

// Parallel to AgentSiteContext.jsx, for the one singleton brokerage site
// instead of a per-agent one. `site` is the adaptBrokerageSite() shape.
const BrokerageSiteContext = createContext(null);

export function BrokerageSiteProvider({ value, children }) {
  return <BrokerageSiteContext.Provider value={value}>{children}</BrokerageSiteContext.Provider>;
}

export function useBrokerageSiteContext() {
  const ctx = useContext(BrokerageSiteContext);
  if (!ctx) throw new Error("useBrokerageSiteContext must be used within BrokerageSiteProvider");
  return ctx;
}
