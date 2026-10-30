-- One more AI connection permission: publish_blog. An agent can allow their AI to put their OWN blog posts live (publish, schedule, unpublish, edit),
-- instead of only saving drafts. Any agent with AI access may allow it; it only ever reaches their own website.
alter table public.oauth_grants drop constraint if exists oauth_grants_scopes_check;
alter table public.oauth_grants add constraint oauth_grants_scopes_check
  check (scopes <@ array['read', 'write_people', 'write_tasks', 'write_deals', 'write_drafts', 'publish_blog', 'manage_blog', 'manage_listings', 'manage_agents', 'manage_sites']::text[] and 'read' = any(scopes));

alter table public.mcp_tokens drop constraint if exists mcp_tokens_scopes_check;
alter table public.mcp_tokens add constraint mcp_tokens_scopes_check
  check (scopes <@ array['read', 'write_people', 'write_tasks', 'write_deals', 'write_drafts', 'publish_blog', 'manage_blog', 'manage_listings', 'manage_agents', 'manage_sites']::text[] and 'read' = any(scopes));
