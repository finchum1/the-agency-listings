-- Curated, ordered subset of a listing's photos used to drive the
-- Luxury template's scroll-scrubbed hero when the listing has no real
-- hero video. null = not included; a non-null integer = its position
-- (0-based) in the sequence. Deliberately separate from the existing
-- sort_order/is_hero (which drive the regular Gallery.jsx grid) since
-- the best narrative order for a scroll walkthrough often isn't the
-- same as the best browsing order for a photo grid. Applied via the
-- Supabase MCP.
alter table listing_photos add column if not exists hero_scroll_order integer;
