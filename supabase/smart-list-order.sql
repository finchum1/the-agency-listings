-- Smart lists can be rearranged: each one gets a position, starting from the order they were made in.
alter table public.contact_smart_lists add column if not exists position integer not null default 0;

update public.contact_smart_lists l
set position = r.n
from (select id, row_number() over (partition by owner_id order by created_at, id) as n from public.contact_smart_lists) r
where l.id = r.id and l.position = 0;
