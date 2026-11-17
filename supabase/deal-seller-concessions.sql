-- Seller concessions on a deal: the dollar amount the seller pays toward the buyer's costs at closing (closing costs, repairs credit, a home warranty and so on).
-- One number per deal, like the commission and the earnest money; nothing is worked out from it.
alter table public.people
  add column if not exists seller_concessions numeric check (seller_concessions is null or seller_concessions >= 0);
