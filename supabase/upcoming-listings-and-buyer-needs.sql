-- Two new internal-only dashboard modules — neither has any public route,
-- theming, or SEO surface; both are pure office tools:
--
-- upcoming_listings: informal "coming soon" tracking before a property is
-- a real, public `listings` row — an agent jots down what they know
-- (beds/baths/rough size, an estimated price, notes) while they wait on
-- the seller. Deliberately NOT the same table as `listings`, which is
-- built to generate a full public listing site (slug, SEO, photo
-- galleries, hero video) — overkill for "I have a lead on a property."
--
-- buyer_needs: the reverse — what an agent's current buyers are looking
-- for, so the office can spot a match between a colleague's off-market
-- lead and someone else's buyer.
--
-- Both are office-wide read (any logged-in agent/admin sees everything —
-- that's the whole point of tracking either one) but write-restricted to
-- the owning agent or an admin, same ownership model as `listings`.

-- ---------------------------------------------------------------------
-- upcoming_listings
-- ---------------------------------------------------------------------
create table if not exists upcoming_listings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'listed', 'cancelled')),
  address_line1 text not null default '',
  city text not null default '',
  state text not null default 'OK',
  zip text not null default '',
  price_estimate numeric,
  beds integer,
  baths numeric,
  sqft integer,
  property_type text not null default 'Single Family Home',
  lot_size text not null default '',
  expected_list_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table upcoming_listings enable row level security;

drop policy if exists "upcoming_listings_read_authenticated" on upcoming_listings;
create policy "upcoming_listings_read_authenticated" on upcoming_listings
  for select
  using (auth.uid() is not null);

drop policy if exists "upcoming_listings_insert_own_or_admin" on upcoming_listings;
create policy "upcoming_listings_insert_own_or_admin" on upcoming_listings
  for insert
  with check (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "upcoming_listings_update_own_or_admin" on upcoming_listings;
create policy "upcoming_listings_update_own_or_admin" on upcoming_listings
  for update
  using (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "upcoming_listings_delete_own_or_admin" on upcoming_listings;
create policy "upcoming_listings_delete_own_or_admin" on upcoming_listings
  for delete
  using (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop trigger if exists upcoming_listings_set_updated_at on upcoming_listings;
create trigger upcoming_listings_set_updated_at
  before update on upcoming_listings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- buyer_needs
-- ---------------------------------------------------------------------
create table if not exists buyer_needs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'matched', 'closed')),
  buyer_name text not null default '',
  buyer_contact text not null default '',
  min_price numeric,
  max_price numeric,
  min_beds integer,
  min_baths numeric,
  areas text not null default '',
  property_type text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table buyer_needs enable row level security;

drop policy if exists "buyer_needs_read_authenticated" on buyer_needs;
create policy "buyer_needs_read_authenticated" on buyer_needs
  for select
  using (auth.uid() is not null);

drop policy if exists "buyer_needs_insert_own_or_admin" on buyer_needs;
create policy "buyer_needs_insert_own_or_admin" on buyer_needs
  for insert
  with check (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "buyer_needs_update_own_or_admin" on buyer_needs;
create policy "buyer_needs_update_own_or_admin" on buyer_needs
  for update
  using (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "buyer_needs_delete_own_or_admin" on buyer_needs;
create policy "buyer_needs_delete_own_or_admin" on buyer_needs
  for delete
  using (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop trigger if exists buyer_needs_set_updated_at on buyer_needs;
create trigger buyer_needs_set_updated_at
  before update on buyer_needs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Realtime — same convention as listings/agent_sites/etc., so the list
-- pages update live when a colleague adds or edits an entry.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table upcoming_listings;
alter publication supabase_realtime add table buyer_needs;
