-- More header and footer layouts for the agent sites, and a menu order the agent sets.
--   footer_style  classic | centered | cta | wide | slim          (header_style gains centered | stacked | centered_pill | minimal;
--                                                                  it has no check constraint, the app only reads the ones it knows)
--   nav_order     page paths in the order the agent wants them in the header and footer menus, e.g. {/about,/sellers,/contact}. A page not
--                 listed (a newly turned-on one) follows the listed ones; an empty list is the default order.
alter table public.agent_sites
  add column if not exists footer_style text not null default 'classic',
  add column if not exists nav_order text[] not null default '{}';
