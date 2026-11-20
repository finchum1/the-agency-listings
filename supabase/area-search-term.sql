-- Area pages: an optional "search for" value per area. The Home Search on an area page starts on the area's NAME; where the name isn't a city the MLS
-- knows (a neighborhood such as "Carlton Landing"), this holds the city to search instead. Empty = use the name.
alter table public.agent_site_areas add column if not exists search_term text not null default '' check (length(search_term) <= 80);
alter table public.brokerage_areas add column if not exists search_term text not null default '' check (length(search_term) <= 80);
alter table public.area_template_areas add column if not exists search_term text not null default '' check (length(search_term) <= 80);
