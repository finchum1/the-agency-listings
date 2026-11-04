-- Lets each agent choose which pages sit in the site header's bar and which go in the menu button beside the phone number.
--   nav_menu  the page paths (e.g. {/blog,/sellers,/home-value}) that go in the menu button instead of the bar. null (the default) is the standard split:
--             up to six pages all in the bar, and with more than six only About, Listings, Areas and Contact in the bar. An empty list puts every page
--             in the bar. The footer is not affected.
alter table public.agent_sites add column if not exists nav_menu text[];
