-- Lets an organization's admins (and the platform owner) edit the Areas of Expertise every new agent site in their organization starts with
-- (area_template_areas), from Dashboard > Area Templates. Until now the table had RLS on and no policies, so it could only be changed from SQL.
-- Reading is also limited to people who can manage that organization: nobody else needs the template, since copy_template_areas is a
-- security-definer trigger and does not go through these policies.
create policy area_template_areas_manage on public.area_template_areas for all
  using (org_id is not null and public.can_manage_org(org_id))
  with check (org_id is not null and public.can_manage_org(org_id));

-- Photos for template areas upload to the agent-site-photos bucket under a folder named "area-templates-<organization id>", because the
-- existing upload rules only allow a folder named for an agent site. Same rule, for the organization's admins.
create policy area_template_photos_insert on storage.objects for insert with check (
  bucket_id = 'agent-site-photos'
  and exists (select 1 from public.organizations o
    where 'area-templates-' || o.id::text = (storage.foldername(name))[1] and public.can_manage_org(o.id)));
create policy area_template_photos_delete on storage.objects for delete using (
  bucket_id = 'agent-site-photos'
  and exists (select 1 from public.organizations o
    where 'area-templates-' || o.id::text = (storage.foldername(name))[1] and public.can_manage_org(o.id)));
