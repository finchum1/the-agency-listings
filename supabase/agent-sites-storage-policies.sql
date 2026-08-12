-- =====================================================================
-- Storage policies for agent-site photos
--
-- FIRST, in the Supabase dashboard: Storage > New bucket
--   name: agent-site-photos
--   Public bucket: ON
--
-- THEN run this in the SQL Editor. Photos are uploaded to paths shaped
-- like  {agent_site_id}/{filename}  — mirrors listing-photos' scheme.
-- These policies check that the agent_site_id folder belongs to the
-- uploading agent (or an admin).
-- =====================================================================

drop policy if exists "agent_site_photos_bucket_public_read" on storage.objects;
create policy "agent_site_photos_bucket_public_read" on storage.objects
  for select
  using (bucket_id = 'agent-site-photos');

drop policy if exists "agent_site_photos_bucket_insert_own_or_admin" on storage.objects;
create policy "agent_site_photos_bucket_insert_own_or_admin" on storage.objects
  for insert
  with check (
    bucket_id = 'agent-site-photos'
    and exists (
      select 1 from agent_sites s
      where s.id::text = (storage.foldername(name))[1]
        and (
          s.agent_id = auth.uid()
          or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

drop policy if exists "agent_site_photos_bucket_delete_own_or_admin" on storage.objects;
create policy "agent_site_photos_bucket_delete_own_or_admin" on storage.objects
  for delete
  using (
    bucket_id = 'agent-site-photos'
    and exists (
      select 1 from agent_sites s
      where s.id::text = (storage.foldername(name))[1]
        and (
          s.agent_id = auth.uid()
          or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );
