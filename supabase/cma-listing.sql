-- Attach a CMA to a listing and compare it later. `attach` freezes what the CMA said (suggested price and range) and what the home was listed at the
-- day it was attached, so a later edit to the CMA doesn't rewrite history; the agent can add what it finally sold for. See src/lib/cmaAttach.js.
alter table public.cmas add column if not exists listing_id uuid references public.listings(id) on delete set null;
alter table public.cmas add column if not exists attach jsonb not null default '{}'::jsonb check (jsonb_typeof(attach) = 'object' and pg_column_size(attach) < 2000);
create index if not exists cmas_listing_idx on public.cmas (listing_id) where listing_id is not null;
grant select (listing_id, attach) on public.cmas to authenticated;
grant update (listing_id, attach) on public.cmas to authenticated;
