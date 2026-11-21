-- A seller's net sheet lives on the CMA: the loan payoff and costs of selling, worked out at each price (src/lib/netSheet.js). An object, empty until the
-- agent starts one. The client page only gets it when the agent turned "show" on (api/cma-share.js).
alter table public.cmas add column if not exists net_sheet jsonb not null default '{}'::jsonb check (jsonb_typeof(net_sheet) = 'object' and pg_column_size(net_sheet) < 8000);
grant select (net_sheet) on public.cmas to authenticated;
grant insert (net_sheet) on public.cmas to authenticated;
grant update (net_sheet) on public.cmas to authenticated;
