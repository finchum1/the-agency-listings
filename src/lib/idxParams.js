// Query string for one listing lookup against /api/repliers. `org` (the organization's slug) tells the server whose
// IDX account to use when the request comes from a platform host; on an organization's own domain the server
// ignores it and uses that domain's organization.
export function idxParams(mlsNumber, org) {
  const params = new URLSearchParams({ mlsNumber });
  if (org) params.set("org", org);
  return params.toString();
}
