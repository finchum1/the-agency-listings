-- =====================================================================
-- Storage policies for listing photos
--
-- FIRST, in the Supabase dashboard: Storage > New bucket
--   name: listing-photos
--   Public bucket: ON
--
-- THEN run this in the SQL Editor. Photos are uploaded to paths shaped
-- like  {listing_id}/{filename}  — these policies check that the
-- listing_id folder belongs to the uploading agent (or an admin).
-- =====================================================================

drop policy if exists "listing_photos_bucket_public_read" on storage.objects;
create policy "listing_photos_bucket_public_read" on storage.objects
  for select
  using (bucket_id = 'listing-photos');

drop policy if exists "listing_photos_bucket_insert_own_or_admin" on storage.objects;
create policy "listing_photos_bucket_insert_own_or_admin" on storage.objects
  for insert
  with check (
    bucket_id = 'listing-photos'
    and exists (
      select 1 from listings l
      where l.id::text = (storage.foldername(name))[1]
        and (
          l.agent_id = auth.uid()
          or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

drop policy if exists "listing_photos_bucket_delete_own_or_admin" on storage.objects;
create policy "listing_photos_bucket_delete_own_or_admin" on storage.objects
  for delete
  using (
    bucket_id = 'listing-photos'
    and exists (
      select 1 from listings l
      where l.id::text = (storage.foldername(name))[1]
        and (
          l.agent_id = auth.uid()
          or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );
