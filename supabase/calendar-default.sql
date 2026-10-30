-- A default calendar for new events: the one the "Add" form starts on. At most one per agent (the partial unique index); it is only ever a Google
-- calendar the agent can write to, which the dashboard checks before offering it.
alter table public.agent_calendars add column if not exists is_default boolean not null default false;
create unique index if not exists agent_calendars_one_default on public.agent_calendars (owner_id) where is_default;
