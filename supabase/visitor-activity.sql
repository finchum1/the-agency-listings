-- What a lead did on the agent's website Home Search, for the agent's own view of that person. A visitor (site_visitors) is matched to a person by
-- email: the person must be the signed-in agent's own, and the visitor one who signed in on one of that agent's sites. Returns null when there is
-- no match. The visitor tables stay unreadable from the browser (no policies); this function is the only way in, and only for the agent.
create or replace function public.person_visitor_activity(p_person_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_person record;
  v_visitor record;
begin
  if auth.uid() is null then return null; end if;
  select id, owner_id, email into v_person from public.people where id = p_person_id;
  if not found or v_person.owner_id <> auth.uid() or btrim(coalesce(v_person.email, '')) = '' then return null; end if;
  select sv.id, sv.name, sv.created_at, sv.last_login_at, sv.unsubscribed_at into v_visitor
    from public.site_visitors sv
    join public.agent_sites s on s.id = sv.agent_site_id
   where s.agent_id = v_person.owner_id and lower(sv.email) = lower(btrim(v_person.email))
   order by sv.last_login_at desc nulls last
   limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'visitor', jsonb_build_object('name', v_visitor.name, 'joined', v_visitor.created_at, 'last_login', v_visitor.last_login_at, 'emails_off', v_visitor.unsubscribed_at is not null),
    'searches', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'params', x.params, 'alerts', x.alerts, 'saved', x.created_at, 'last_alert', x.last_alert_at) order by x.created_at desc)
                            from public.visitor_saved_searches x where x.visitor_id = v_visitor.id), '[]'::jsonb),
    'favorites', coalesce((select jsonb_agg(jsonb_build_object('mls', f.mls_number, 'snapshot', f.snapshot, 'saved', f.created_at) order by f.created_at desc)
                             from (select * from public.visitor_favorites where visitor_id = v_visitor.id order by created_at desc limit 60) f), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.person_visitor_activity(uuid) from public, anon;
grant execute on function public.person_visitor_activity(uuid) to authenticated;
