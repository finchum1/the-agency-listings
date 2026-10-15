-- MULTI-TENANT PHASE 1, PART C: organization-aware access rules (RLS), storage rules, and function updates.
-- Run after parts A and B, in ONE transaction. Apply to STAGING first, then run supabase/tests/cross-tenant-leak-test.sql.
-- Rollback: the access rules and functions from before this change are saved in the backup folder
-- (rollback-policies-and-functions.sql).
--
-- Replaces "role = 'admin' means admin of everything" with:
--   can_manage_org(org) = platform owner, or an admin of that organization
-- Shared office boards (upcoming listings, buyer needs) become same-organization only.
-- Profiles stop being readable by everyone: only the account itself, its organization, the platform owner,
-- and agents who have something published (a site or listing) are visible to the public.
-- People/CRM rules are unchanged: private to the agent, not even visible to admins.

-- ---------------------------------------------------------- remove the old rules
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

drop policy if exists "agent_site_photos_bucket_delete_own_or_admin" on storage.objects;
drop policy if exists "agent_site_photos_bucket_insert_own_or_admin" on storage.objects;
drop policy if exists "agent_site_photos_bucket_public_read" on storage.objects;
drop policy if exists "brokerage_site_photos_bucket_admin_delete" on storage.objects;
drop policy if exists "brokerage_site_photos_bucket_admin_insert" on storage.objects;
drop policy if exists "brokerage_site_photos_bucket_public_read" on storage.objects;
drop policy if exists "listing_photos_bucket_delete_own_or_admin" on storage.objects;
drop policy if exists "listing_photos_bucket_insert_own_or_admin" on storage.objects;
drop policy if exists "listing_photos_bucket_public_read" on storage.objects;
drop policy if exists "profile_photos_bucket_delete_own_or_admin" on storage.objects;
drop policy if exists "profile_photos_bucket_insert_own_or_admin" on storage.objects;
drop policy if exists "profile_photos_bucket_public_read" on storage.objects;

-- --------------------------------------------------------------- functions
-- Only the platform owner can move an account between organizations. A brokerage's admins can change
-- role / site access / People access / login for members of their OWN organization. Solo agents' switches
-- belong to the platform owner (you sell what they pay for). Service role (no signed-in user) is allowed.
create or replace function public.guard_profile_privileged_columns() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then return new; end if;
  if public.is_platform_admin() then return new; end if;
  if new.org_id is distinct from old.org_id then
    raise exception 'Only the platform owner can change which organization an account belongs to.';
  end if;
  if new.role is distinct from old.role
     or new.site_access is distinct from old.site_access
     or new.people_enabled is distinct from old.people_enabled
     or new.login_enabled is distinct from old.login_enabled then
    if exists (
      select 1 from public.profiles p join public.organizations o on o.id = p.org_id
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = old.org_id and o.type = 'brokerage'
    ) then
      return new;
    end if;
    raise exception 'Only an admin can change role, site access, People access, or login access.';
  end if;
  return new;
end;
$$;

-- New agent sites start with their own organization's template areas (not everyone's).
create or replace function public.copy_template_areas() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  insert into public.agent_site_areas (agent_site_id, slug, name, blurb, description, photo_url, sort_order, stats)
  select new.id, t.slug, t.name, t.blurb, t.description, t.photo_url, t.sort_order, t.stats
  from public.area_template_areas t
  where t.org_id = new.org_id;
  return new;
end;
$$;

-- Which organization does an uploaded brokerage file belong to? Files are filed under a first folder that is either
-- the organization's id (new convention) or the brokerage SITE's id (what the dashboard uploads use today; every existing
-- file is filed that way). Anything else is treated as The Agency's, so nobody else can write there.
create or replace function public.storage_path_org(path text) returns uuid
language sql stable security definer set search_path = public as
$$
  select coalesce(
    (select o.id from public.organizations o where o.id::text = (storage.foldername(path))[1]),
    (select s.org_id from public.brokerage_site s where s.id::text = (storage.foldername(path))[1]),
    (select id from public.organizations where slug = 'the-agency-oklahoma')
  )
$$;

-- ------------------------------------------------- new tables: privileges + rules
alter table public.organizations enable row level security;
alter table public.org_settings enable row level security;
alter table public.org_domains enable row level security;
alter table public.platform_admins enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.platform_admins from anon, authenticated;
revoke all on public.org_settings from anon;
revoke all on public.audit_log from anon;
revoke insert, update, delete on public.organizations from anon;
revoke insert, update, delete on public.org_domains from anon;

create policy organizations_public_read on public.organizations for select to anon, authenticated using (status = 'active');
create policy organizations_platform_write on public.organizations for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy org_settings_read on public.org_settings for select to authenticated
  using (org_id = public.current_org_id() or public.is_platform_admin());
create policy org_settings_platform_write on public.org_settings for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy org_domains_public_read on public.org_domains for select to anon, authenticated using (true);
create policy org_domains_platform_write on public.org_domains for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy audit_log_platform on public.audit_log for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ------------------------------------------------------------------- profiles
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or org_id = public.current_org_id()
  or public.is_platform_admin()
  or exists (select 1 from public.agent_sites s where s.agent_id = profiles.id and s.status <> 'draft')
  or exists (select 1 from public.listings l where l.agent_id = profiles.id and l.status <> 'draft')
);
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.can_manage_org(org_id))
  with check (id = auth.uid() or public.can_manage_org(org_id));

-- ------------------------------------------------------------ listings and children
create policy listings_public_read on public.listings for select using (status <> 'draft');
create policy listings_member_read on public.listings for select using (auth.uid() = agent_id or public.can_manage_org(org_id));
create policy listings_insert on public.listings for insert
  with check (public.can_manage_org(org_id) or (auth.uid() = agent_id and org_id = public.current_org_id()));
create policy listings_update on public.listings for update
  using (auth.uid() = agent_id or public.can_manage_org(org_id))
  with check (public.can_manage_org(org_id) or (auth.uid() = agent_id and org_id = public.current_org_id()));
create policy listings_delete on public.listings for delete using (auth.uid() = agent_id or public.can_manage_org(org_id));

create policy listing_photos_public_read on public.listing_photos for select
  using (exists (select 1 from public.listings l where l.id = listing_photos.listing_id and l.status <> 'draft'));
create policy listing_photos_manage on public.listing_photos for all
  using (exists (select 1 from public.listings l where l.id = listing_photos.listing_id and (l.agent_id = auth.uid() or public.can_manage_org(l.org_id))))
  with check (exists (select 1 from public.listings l where l.id = listing_photos.listing_id and (l.agent_id = auth.uid() or public.can_manage_org(l.org_id))));

create policy open_houses_public_read on public.open_houses for select
  using (exists (select 1 from public.listings l where l.id = open_houses.listing_id and l.status <> 'draft'));
create policy open_houses_manage on public.open_houses for all
  using (exists (select 1 from public.listings l where l.id = open_houses.listing_id and (l.agent_id = auth.uid() or public.can_manage_org(l.org_id))))
  with check (exists (select 1 from public.listings l where l.id = open_houses.listing_id and (l.agent_id = auth.uid() or public.can_manage_org(l.org_id))));

-- ------------------------------------------------------- agent sites and children
create policy agent_sites_public_read on public.agent_sites for select using (status <> 'draft');
create policy agent_sites_member_read on public.agent_sites for select using (auth.uid() = agent_id or public.can_manage_org(org_id));
create policy agent_sites_insert on public.agent_sites for insert
  with check (public.can_manage_org(org_id) or (auth.uid() = agent_id and org_id = public.current_org_id()));
create policy agent_sites_update on public.agent_sites for update
  using (auth.uid() = agent_id or public.can_manage_org(org_id))
  with check (public.can_manage_org(org_id) or (auth.uid() = agent_id and org_id = public.current_org_id()));
create policy agent_sites_delete on public.agent_sites for delete using (auth.uid() = agent_id or public.can_manage_org(org_id));

create policy agent_site_areas_public_read on public.agent_site_areas for select
  using (exists (select 1 from public.agent_sites s where s.id = agent_site_areas.agent_site_id and s.status <> 'draft'));
create policy agent_site_areas_manage on public.agent_site_areas for all
  using (exists (select 1 from public.agent_sites s where s.id = agent_site_areas.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))))
  with check (exists (select 1 from public.agent_sites s where s.id = agent_site_areas.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))));

create policy agent_site_posts_public_read on public.agent_site_posts for select
  using (((status = 'published') or (status = 'scheduled' and scheduled_at <= now()))
         and exists (select 1 from public.agent_sites s where s.id = agent_site_posts.agent_site_id and s.status <> 'draft'));
create policy agent_site_posts_manage on public.agent_site_posts for all
  using (exists (select 1 from public.agent_sites s where s.id = agent_site_posts.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))))
  with check (exists (select 1 from public.agent_sites s where s.id = agent_site_posts.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))));

create policy agent_site_testimonials_public_read on public.agent_site_testimonials for select
  using (exists (select 1 from public.agent_sites s where s.id = agent_site_testimonials.agent_site_id and s.status <> 'draft'));
create policy agent_site_testimonials_manage on public.agent_site_testimonials for all
  using (exists (select 1 from public.agent_sites s where s.id = agent_site_testimonials.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))))
  with check (exists (select 1 from public.agent_sites s where s.id = agent_site_testimonials.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))));

create policy agent_blog_calendar_manage on public.agent_blog_calendar for all
  using (exists (select 1 from public.agent_sites s where s.id = agent_blog_calendar.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))))
  with check (exists (select 1 from public.agent_sites s where s.id = agent_blog_calendar.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))));

create policy site_redirects_public_read on public.site_redirects for select using (true);
create policy site_redirects_manage on public.site_redirects for all
  using (exists (select 1 from public.agent_sites s where s.id = site_redirects.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))))
  with check (exists (select 1 from public.agent_sites s where s.id = site_redirects.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))));

-- ------------------------------------------------------------ leads and analytics
create policy leads_read on public.leads for select using (auth.uid() = agent_id or public.can_manage_org(org_id));
create policy page_views_read on public.page_views for select using (
  public.can_manage_org(org_id)
  or (target_type = 'listing' and exists (select 1 from public.listings l where l.id = page_views.target_id and l.agent_id = auth.uid()))
  or (target_type = 'agent_site' and exists (select 1 from public.agent_sites s where s.id = page_views.target_id and s.agent_id = auth.uid()))
  or (target_type = 'agent_post' and exists (select 1 from public.agent_site_posts ap join public.agent_sites s on s.id = ap.agent_site_id where ap.id = page_views.target_id and s.agent_id = auth.uid()))
);

-- ------------------------------------------- shared office boards: same organization only
create policy upcoming_listings_read on public.upcoming_listings for select
  using (org_id = public.current_org_id() or public.is_platform_admin());
create policy upcoming_listings_insert on public.upcoming_listings for insert
  with check (public.can_manage_org(org_id) or (auth.uid() = agent_id and org_id = public.current_org_id()));
create policy upcoming_listings_update on public.upcoming_listings for update
  using (auth.uid() = agent_id or public.can_manage_org(org_id))
  with check (public.can_manage_org(org_id) or (auth.uid() = agent_id and org_id = public.current_org_id()));
create policy upcoming_listings_delete on public.upcoming_listings for delete using (auth.uid() = agent_id or public.can_manage_org(org_id));

create policy buyer_needs_read on public.buyer_needs for select
  using (org_id = public.current_org_id() or public.is_platform_admin());
create policy buyer_needs_insert on public.buyer_needs for insert
  with check (public.can_manage_org(org_id) or (auth.uid() = agent_id and org_id = public.current_org_id()));
create policy buyer_needs_update on public.buyer_needs for update
  using (auth.uid() = agent_id or public.can_manage_org(org_id))
  with check (public.can_manage_org(org_id) or (auth.uid() = agent_id and org_id = public.current_org_id()));
create policy buyer_needs_delete on public.buyer_needs for delete using (auth.uid() = agent_id or public.can_manage_org(org_id));

-- ------------------------------------------------------------ brokerage website
create policy brokerage_site_public_read on public.brokerage_site for select using (status <> 'draft');
create policy brokerage_site_manage on public.brokerage_site for all
  using (public.can_manage_org(org_id)) with check (public.can_manage_org(org_id));

create policy brokerage_agents_public_read on public.brokerage_agents for select
  using (exists (select 1 from public.brokerage_site s where s.org_id = brokerage_agents.org_id and s.status <> 'draft'));
create policy brokerage_agents_manage on public.brokerage_agents for all
  using (public.can_manage_org(org_id)) with check (public.can_manage_org(org_id));

create policy brokerage_areas_public_read on public.brokerage_areas for select
  using (exists (select 1 from public.brokerage_site s where s.org_id = brokerage_areas.org_id and s.status <> 'draft'));
create policy brokerage_areas_manage on public.brokerage_areas for all
  using (public.can_manage_org(org_id)) with check (public.can_manage_org(org_id));

create policy brokerage_posts_public_read on public.brokerage_posts for select
  using (((status = 'published') or (status = 'scheduled' and scheduled_at <= now()))
         and exists (select 1 from public.brokerage_site s where s.org_id = brokerage_posts.org_id and s.status <> 'draft'));
create policy brokerage_posts_manage on public.brokerage_posts for all
  using (public.can_manage_org(org_id)) with check (public.can_manage_org(org_id));

-- ------------------------------------------- People / CRM: unchanged, private to the agent
create policy people_owner_all on public.people for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));
create policy people_notes_owner_all on public.people_notes for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled)
              and exists (select 1 from public.people pe where pe.id = people_notes.person_id and pe.owner_id = auth.uid()));
create policy people_settings_owner_all on public.people_settings for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));
create policy checklist_templates_owner_all on public.checklist_templates for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));
create policy document_templates_owner_all on public.document_templates for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));
create policy transaction_tasks_owner_all on public.transaction_tasks for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled)
              and exists (select 1 from public.people pe where pe.id = transaction_tasks.person_id and pe.owner_id = auth.uid()));
create policy transaction_documents_owner_all on public.transaction_documents for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled)
              and exists (select 1 from public.people pe where pe.id = transaction_documents.person_id and pe.owner_id = auth.uid()));

-- ----------------------------------------------------------------- file storage
create policy agent_site_photos_public_read on storage.objects for select using (bucket_id = 'agent-site-photos');
create policy agent_site_photos_insert on storage.objects for insert with check (
  bucket_id = 'agent-site-photos' and exists (select 1 from public.agent_sites s
    where s.id::text = (storage.foldername(name))[1] and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))));
create policy agent_site_photos_delete on storage.objects for delete using (
  bucket_id = 'agent-site-photos' and exists (select 1 from public.agent_sites s
    where s.id::text = (storage.foldername(name))[1] and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))));

create policy listing_photos_public_read on storage.objects for select using (bucket_id = 'listing-photos');
create policy listing_photos_insert on storage.objects for insert with check (
  bucket_id = 'listing-photos' and exists (select 1 from public.listings l
    where l.id::text = (storage.foldername(name))[1] and (l.agent_id = auth.uid() or public.can_manage_org(l.org_id))));
create policy listing_photos_delete on storage.objects for delete using (
  bucket_id = 'listing-photos' and exists (select 1 from public.listings l
    where l.id::text = (storage.foldername(name))[1] and (l.agent_id = auth.uid() or public.can_manage_org(l.org_id))));

create policy profile_photos_public_read on storage.objects for select using (bucket_id = 'profile-photos');
create policy profile_photos_insert on storage.objects for insert with check (
  bucket_id = 'profile-photos' and (auth.uid()::text = (storage.foldername(name))[1]
    or exists (select 1 from public.profiles p where p.id::text = (storage.foldername(name))[1] and public.can_manage_org(p.org_id))));
create policy profile_photos_delete on storage.objects for delete using (
  bucket_id = 'profile-photos' and (auth.uid()::text = (storage.foldername(name))[1]
    or exists (select 1 from public.profiles p where p.id::text = (storage.foldername(name))[1] and public.can_manage_org(p.org_id))));

create policy brokerage_site_photos_public_read on storage.objects for select using (bucket_id = 'brokerage-site-photos');
create policy brokerage_site_photos_insert on storage.objects for insert
  with check (bucket_id = 'brokerage-site-photos' and public.can_manage_org(public.storage_path_org(name)));
create policy brokerage_site_photos_delete on storage.objects for delete
  using (bucket_id = 'brokerage-site-photos' and public.can_manage_org(public.storage_path_org(name)));
