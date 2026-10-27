-- =====================================================================
-- A coordinator can delete a deal they coordinate (the three-dot menu on the deal, like the agent's own). The people table only lets the
-- owner delete, so this is a function that checks the caller really is that deal's coordinator (deal_person_access = 'tc') and removes it.
-- The deal's tasks, documents, messages, signatures and links go with it (they cascade), exactly as when the agent deletes it.
-- =====================================================================
create or replace function public.delete_coordinated_deal(p_person_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  if public.deal_person_access(p_person_id) is distinct from 'tc' then
    raise exception 'Only the coordinator of a deal can delete it from here.';
  end if;
  delete from public.people where id = p_person_id and stage_group = 'transaction';
end;
$$;
revoke all on function public.delete_coordinated_deal(uuid) from public, anon;
grant execute on function public.delete_coordinated_deal(uuid) to authenticated;
