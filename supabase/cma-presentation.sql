-- A listing presentation is a CMA dressed for the listing appointment: a note to the sellers, a bit about the agent, a marketing plan checklist, then the
-- CMA and (optionally) the net sheet, as one PDF. The words live here, on the CMA (src/lib/presentation.js); the numbers come from the CMA itself.
alter table public.cmas add column if not exists presentation jsonb not null default '{}'::jsonb check (jsonb_typeof(presentation) = 'object' and pg_column_size(presentation) < 20000);
grant select (presentation) on public.cmas to authenticated;
grant update (presentation) on public.cmas to authenticated;
