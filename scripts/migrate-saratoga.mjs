// One-off migration: brings 1645 Saratoga Way's real listing data and
// photos (already sitting in ../1645-saratoga-way/) into this app's
// Supabase database as the first real row.
//
// Run with:
//   node --env-file=.env scripts/migrate-saratoga.mjs
//
// Requires a local .env (gitignored, YOU create this — never paste the
// service role key into chat) with:
//   VITE_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...   (Project Settings > API > service_role)
//   MIGRATE_AGENT_EMAIL=terrence.finchum@theagencyre.com
//     (must already exist as a profiles row — see schema.sql's
//      "bootstrap the first admin" step)

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SARATOGA_ROOT = path.resolve(__dirname, "../../1645-saratoga-way");

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const agentEmail = process.env.MIGRATE_AGENT_EMAIL;

if (!supabaseUrl || !serviceKey || !agentEmail) {
  console.error(
    "Missing env vars. Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIGRATE_AGENT_EMAIL in .env"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function uploadFile(localPath, storagePath, contentType) {
  const file = await readFile(localPath);
  const { error } = await supabase.storage
    .from("listing-photos")
    .upload(storagePath, file, { contentType, upsert: true });
  if (error) throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
  const { data } = supabase.storage.from("listing-photos").getPublicUrl(storagePath);
  return data.publicUrl;
}

async function main() {
  console.log("Looking up agent profile for", agentEmail, "…");
  const { data: agent, error: agentError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("email", agentEmail)
    .single();
  if (agentError || !agent) {
    throw new Error(
      `No profile found for ${agentEmail}. Create that account first (see schema.sql bootstrap step).`
    );
  }
  console.log(`Found agent: ${agent.full_name} (${agent.id})`);

  const listingPayload = {
    slug: "1645-saratoga-way",
    agent_id: agent.id,
    status: "for_sale",
    mls_number: "1224238",
    address_line1: "1645 Saratoga Way",
    city: "Edmond",
    state: "OK",
    zip: "73003",
    price: 1395000,
    beds: 4,
    baths: 7,
    sqft: 6886,
    lot_size: "0.75+ acres",
    year_built: "1995",
    garage: "4-car",
    property_type: "Single Family Estate",
    description: [
      "Tucked behind the gates of Saratoga Farms — one of Edmond's most private luxury communities — this 6,886-square-foot estate sits on just over three-quarters of an acre with no rear neighbors and a backyard built for entertaining.",
      "Inside, you'll find 4 bedrooms, 5 full bathrooms, and 2 half baths, a dedicated study for anyone working from home, and a true media room for movie nights. A butler's pantry adds both elegance and function for hosting, and multiple living and dining areas give the home real flow for everyday life or larger gatherings.",
      "Outside, a resort-style pool pairs with an elevated, overflowing hot tub for a setting that feels more like a private retreat than a backyard. Recent updates include a whole-home generator and a Class 4 impact-resistant roof less than three years old — the kind of details that matter as much as the finishes.",
      "This is a rare opportunity to own a meticulously maintained estate in one of Edmond's most private communities, minutes from Oak Tree Golf & Country Club and Downtown Edmond.",
    ],
    features: [
      {
        category: "Interior",
        items: [
          "4 bedrooms, 5 full + 2 half baths",
          "Dedicated study",
          "True media room",
          "Butler's pantry",
          "Multiple living & dining areas",
        ],
      },
      {
        category: "Exterior",
        items: [
          "Resort-style pool",
          "Elevated, overflowing hot tub",
          "0.75+ acre lot, no rear neighbors",
          "Whole-home generator",
          "Class 4 impact-resistant roof (< 3 years old)",
        ],
      },
      {
        category: "Community & Location",
        items: [
          "Gated Saratoga Farms community",
          "Minutes to Oak Tree Golf & Country Club",
          "Close to Downtown Edmond dining & shops",
          "Quick access to I-35",
          "Roughly 40 homesites, wooded & private",
        ],
      },
    ],
  };

  console.log("Inserting listing row…");
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .upsert(listingPayload, { onConflict: "slug" })
    .select()
    .single();
  if (listingError) throw new Error(`Listing insert failed: ${listingError.message}`);
  console.log(`Listing created: ${listing.id}`);

  console.log("Uploading hero video…");
  const heroVideoUrl = await uploadFile(
    path.join(SARATOGA_ROOT, "public/video/hero.mp4"),
    `${listing.id}/hero.mp4`,
    "video/mp4"
  );
  await supabase.from("listings").update({ hero_video_url: heroVideoUrl }).eq("id", listing.id);
  console.log("Hero video:", heroVideoUrl);

  console.log("Uploading agent headshot…");
  const headshotUrl = await uploadFile(
    path.join(SARATOGA_ROOT, "public/images/agent-headshot.jpg"),
    `${listing.id}/agent-headshot.jpg`,
    "image/jpeg"
  );
  await supabase.from("profiles").update({ photo_url: headshotUrl }).eq("id", agent.id);
  console.log("Headshot:", headshotUrl);

  console.log("Uploading gallery photos…");
  const captions = [
    "Exterior", "Living area", "Kitchen", "Dining", "Primary suite", "Bathroom",
    "Media room", "Study", "Pool & hot tub", "Backyard", "Patio", "Exterior",
  ];
  for (let i = 1; i <= 12; i++) {
    const num = String(i).padStart(2, "0");
    const localPath = path.join(SARATOGA_ROOT, `public/images/gallery/photo-${num}.jpg`);
    const url = await uploadFile(localPath, `${listing.id}/photo-${num}.jpg`, "image/jpeg");
    await supabase.from("listing_photos").insert({
      listing_id: listing.id,
      url,
      caption: captions[i - 1] || "",
      sort_order: i,
      is_hero: i === 1,
    });
    console.log(`  photo-${num}.jpg ✓`);
  }

  console.log("\nDone. View it at /listings/1645-saratoga-way once deployed (or on localhost).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
