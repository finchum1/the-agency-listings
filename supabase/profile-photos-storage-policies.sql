-- =====================================================================
-- Storage policies for agent headshots (profiles.photo_url)
--
-- FIRST, in the Supabase dashboard: Storage > New bucket
--   name: profile-photos
--   Public bucket: ON
--
-- THEN run this in the SQL Editor. Photos are uploaded to paths shaped
-- like  {profile_id}/{filename}  — same scheme as listing-photos and
-- agent-site-photos, EXCEPT this policy doesn't join against an existing
-- row: an admin adding a brand-new agent uploads their headshot BEFORE
-- that agent's profiles row exists (see AgentsPage.jsx's
-- pendingPhotoFolder), so there's nothing yet to join against. Instead,
-- self-upload is checked directly (folder == your own uid, which is
-- always a real, already-existing you), and admins can write to any
-- folder, existing agent or not.
-- =====================================================================

drop policy if exists "profile_photos_bucket_public_read" on storage.objects;
create policy "profile_photos_bucket_public_read" on storage.objects
  for select
  using (bucket_id = 'profile-photos');

drop policy if exists "profile_photos_bucket_insert_own_or_admin" on storage.objects;
create policy "profile_photos_bucket_insert_own_or_admin" on storage.objects
  for insert
  with check (
    bucket_id = 'profile-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

drop policy if exists "profile_photos_bucket_delete_own_or_admin" on storage.objects;
create policy "profile_photos_bucket_delete_own_or_admin" on storage.objects
  for delete
  using (
    bucket_id = 'profile-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );
