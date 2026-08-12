// One-off migration: brings Terrence's real personal-site content (bio,
// testimonials, areas of expertise, blog posts, hero media, headshot —
// already sitting in ../../../terrence-finchum-realty/) into this app's
// Supabase database as agent_sites' first real row. Mirrors
// migrate-saratoga.mjs exactly.
//
// Run with:
//   node --env-file=.env scripts/migrate-terrence-site.mjs
//
// Requires a local .env (gitignored, YOU create this — never paste the
// service role key into chat) with:
//   VITE_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...   (Project Settings > API > service_role)
//   MIGRATE_AGENT_EMAIL=terrence.finchum@theagencyre.com
//     (must already exist as a profiles row — see schema.sql's
//      "bootstrap the first admin" step)
//
// NOTE: this brings over bio/testimonials/areas/blog/hero content only.
// The 1645 Saratoga Way listing itself should already be in `listings`
// via migrate-saratoga.mjs — this script does not touch listings, since
// FeaturedListings on the public agent site reads directly from that
// table by agent_id. Past Transactions (the ~28 sold properties on
// terrence-finchum-realty) aren't migrated by this script either — that's
// a natural follow-up once there's a table/UI for closed-deal history.

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, "../../../../terrence-finchum-realty");

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const agentEmail = process.env.MIGRATE_AGENT_EMAIL;

if (!supabaseUrl || !serviceKey || !agentEmail) {
  console.error(
    "Missing env vars. Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIGRATE_AGENT_EMAIL in .env",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function uploadFile(localPath, storagePath, contentType) {
  const file = await readFile(localPath);
  const { error } = await supabase.storage
    .from("agent-site-photos")
    .upload(storagePath, file, { contentType, upsert: true });
  if (error) throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
  const { data } = supabase.storage.from("agent-site-photos").getPublicUrl(storagePath);
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
      `No profile found for ${agentEmail}. Create that account first (see schema.sql bootstrap step).`,
    );
  }
  console.log(`Found agent: ${agent.full_name} (${agent.id})`);

  const sitePayload = {
    agent_id: agent.id,
    slug: "terrence-finchum",
    status: "published",
    tagline: "TRUSTED GUIDANCE. EXCEPTIONAL RESULTS.",
    region: "Oklahoma City Metro",
    bio: [
      "Terrence Finchum has been a licensed Realtor for over 10 years, including 3 years spent working in lending during that span. He got his start as a transaction coordinator, helping close deals across four states on the East Coast. He then became a licensed Realtor in Kansas and Missouri, closing transactions in both states alongside Oklahoma. Today, he's licensed exclusively in Oklahoma, bringing that multi-state experience to every local transaction.",
      "Outside of real estate, Terrence is first and foremost a family man. He's been married for over 16 years to his high school sweetheart, Brooke, and is the proud father of three sons — Solomon, Bodie, and Maverick. He also serves as a high school tennis coach for Oklahoma Christian School, passing on the same discipline and work ethic that's defined his career.",
      "Whether you're buying, selling, or just starting to explore what's possible, Terrence brings over a decade of hands-on experience — and a genuine investment in getting it right — to every client he works with.",
    ],
    stats: [
      { label: "Years Experience", value: "10+" },
      { label: "States Closed In", value: "3" },
    ],
    instagram_url: "https://instagram.com/terrencefinchum",
    facebook_url: "https://facebook.com/terrencefinchum",
    linkedin_url: "https://linkedin.com/in/terrencefinchum",
  };

  console.log("Upserting agent_sites row…");
  const { data: site, error: siteError } = await supabase
    .from("agent_sites")
    .upsert(sitePayload, { onConflict: "agent_id" })
    .select()
    .single();
  if (siteError) throw new Error(`Site upsert failed: ${siteError.message}`);
  console.log(`Site: ${site.id}`);

  console.log("Uploading headshot…");
  const headshotUrl = await uploadFile(
    path.join(SITE_ROOT, "public/images/headshot.jpg"),
    `${site.id}/headshot.jpg`,
    "image/jpeg",
  );
  await supabase.from("profiles").update({ photo_url: headshotUrl }).eq("id", agent.id);
  console.log("Headshot:", headshotUrl);

  console.log("Uploading hero video + poster…");
  const heroVideoUrl = await uploadFile(
    path.join(SITE_ROOT, "public/images/hero-video.mp4"),
    `${site.id}/hero-video.mp4`,
    "video/mp4",
  );
  const heroPhotoUrl = await uploadFile(
    path.join(SITE_ROOT, "public/images/hero-poster.jpg"),
    `${site.id}/hero-poster.jpg`,
    "image/jpeg",
  );
  await supabase
    .from("agent_sites")
    .update({ hero_video_url: heroVideoUrl, hero_photo_url: heroPhotoUrl })
    .eq("id", site.id);
  console.log("Hero video:", heroVideoUrl);
  console.log("Hero photo:", heroPhotoUrl);

  console.log("Inserting testimonials…");
  const testimonials = [
    {
      quote:
        "Made my home buying experience smooth! Best real estate agent out there! Highly recommend if you want buying a house to be stress free!",
      author: "Daniel Helms",
    },
    {
      quote:
        "I recently worked with Terrence Finchum to buy my house, and I couldn't be happier with how it all went. From start to finish, he made the whole process smooth and straightforward.",
      author: "Luke Helms",
    },
    {
      quote:
        "Terrence was an outstanding real estate agent, professional, knowledgeable, and truly dedicated. He always looked out for our family's best interests and went above and beyond to show us homes while we were moving across state. His communication, care, and commitment made the entire process smooth and stress free. We couldn't have asked for a better experience, I highly recommend Terrence to anyone buying or selling!",
      author: "The Tselekis Family",
    },
  ];
  await supabase.from("agent_site_testimonials").delete().eq("agent_site_id", site.id);
  for (const [i, t] of testimonials.entries()) {
    await supabase
      .from("agent_site_testimonials")
      .insert({ ...t, agent_site_id: site.id, sort_order: i });
  }
  console.log(`  ${testimonials.length} testimonials ✓`);

  console.log("Inserting areas of expertise…");
  const areas = [
    { slug: "oklahoma-city", name: "Oklahoma City", blurb: "Oklahoma's capital, with a growing downtown and diverse neighborhoods across the metro.", description: "Oklahoma's capital and largest city offers everything from historic districts like Heritage Hills to new construction on the growing edges of the metro. With a revitalized downtown, a strong job market, and neighborhoods for every budget and lifestyle, OKC remains the anchor of the metro's real estate market." },
    { slug: "edmond", name: "Edmond", blurb: "A top-ranked suburb just north of OKC, known for its schools, parks, and historic downtown.", description: "Edmond consistently ranks among the best places to live in Oklahoma, thanks to its top-rated schools, walkable downtown, and mix of established neighborhoods and new luxury development. It's home base for Terrence and The Agency Oklahoma's Edmond office." },
    { slug: "arcadia", name: "Arcadia", blurb: "A scenic community northeast of Edmond, home to Route 66 landmarks and acreage properties.", description: "Just northeast of Edmond, Arcadia offers a quieter, more rural feel with larger acreage lots, while still being a short drive from the city. It's known for Route 66 landmarks like the Round Barn and Pops, and continues to attract buyers looking for space without leaving the metro behind." },
    { slug: "deer-creek", name: "Deer Creek", blurb: "A fast-growing area in northwest Oklahoma City known for new construction and top-rated schools.", description: "Deer Creek, in northwest Oklahoma City, has seen rapid growth thanks to Deer Creek Public Schools and a steady pipeline of new-construction neighborhoods. It's a popular choice for families looking for newer homes with easy access to both OKC and Edmond." },
    { slug: "piedmont", name: "Piedmont", blurb: "A rural-feeling community northwest of OKC popular for larger lots and small-town character.", description: "Piedmont sits northwest of Oklahoma City and offers a small-town, rural character with larger lots and acreage — a draw for buyers who want room to spread out while staying within commuting distance of the metro." },
    { slug: "jones", name: "Jones", blurb: "A small town east of Edmond known for wide-open acreage and a close-knit community feel.", description: "East of Edmond, Jones is known for wide-open acreage properties and a tight-knit, small-town community feel — a fit for buyers prioritizing land and privacy over city density." },
    { slug: "nichols-hills", name: "Nichols Hills", blurb: "An upscale, tree-lined enclave surrounded by Oklahoma City, known for its historic estates.", description: "Nichols Hills is one of the metro's most established luxury enclaves — a tree-lined, walkable community of historic and estate homes entirely surrounded by Oklahoma City, with its own shopping district along Avondale." },
    { slug: "yukon", name: "Yukon", blurb: "A family-friendly suburb west of OKC, home to the Chisholm Trail and a walkable downtown.", description: "West of Oklahoma City, Yukon combines small-town charm — its historic downtown and Chisholm Trail heritage — with steady new-home growth, making it a popular choice for families." },
    { slug: "mustang", name: "Mustang", blurb: "A growing suburb southwest of OKC known for its schools and new residential development.", description: "Mustang, southwest of Oklahoma City, continues to see strong growth in new residential development, drawing families with its schools and more affordable price points relative to the rest of the metro." },
  ];
  await supabase.from("agent_site_areas").delete().eq("agent_site_id", site.id);
  for (const [i, a] of areas.entries()) {
    await supabase.from("agent_site_areas").insert({ ...a, agent_site_id: site.id, sort_order: i });
  }
  console.log(`  ${areas.length} areas ✓ (no photos yet — same placeholder state as the live site)`);

  console.log("Uploading blog posts…");
  const posts = [
    {
      slug: "saratoga-farms",
      title: "Inside Saratoga Farms: One of Edmond's Most Private Luxury Communities",
      category: "NEIGHBORHOOD GUIDE",
      post_date: "2026-08-04",
      excerpt: "Tucked behind a private gate in northwest Edmond, Saratoga Farms is one of those neighborhoods that longtime locals talk about but few outsiders ever get to see up close.",
      localImage: "public/images/listings/1645-saratoga-way/photo-01.jpg",
      body: [
        { type: "p", text: "Tucked behind a private gate in northwest Edmond, Saratoga Farms is one of those neighborhoods that longtime locals talk about but few outsiders ever get to see up close. It's a small community — roughly 40 homesites — built around mature trees, winding streets, and a network of walking trails that wind past water features and a community park along a quiet creek." },
        { type: "p", text: "The architecture here isn't cookie-cutter. You'll find Contemporary, English Tudor, and Traditional-style estate homes, many custom-built, each with its own character on generous wooded lots. It's the kind of privacy that's genuinely hard to find inside city limits — no cut-through traffic, no rear neighbors peering into your backyard, just space and quiet." },
        { type: "p", text: "Location-wise, Saratoga Farms sits minutes from Oak Tree Golf & Country Club, one of Oklahoma's most storied golf courses, and just as close to Downtown Edmond's restaurants and shops and a quick shot to I-35 for anyone commuting into Oklahoma City. For buyers who want a country club lifestyle without sacrificing convenience, it's hard to beat." },
        { type: "h3", text: "Featured Listing: 1645 Saratoga Way" },
        { type: "p", text: "I'm excited to share one of my current listings inside the gates at 1645 Saratoga Way — a 6,886-square-foot private estate on just over three-quarters of an acre, with no rear neighbors and a backyard built for entertaining." },
        { type: "p", text: "Inside, you'll find 4 bedrooms, 5 full bathrooms, and 2 half baths, a dedicated study for anyone working from home, and a true media room for movie nights. The butler's pantry adds both elegance and function for hosting, and multiple living and dining areas give the home real flow for everyday life or larger gatherings." },
        { type: "p", text: "Outside, the resort-style pool pairs with an elevated, overflowing hot tub for a setting that feels more like a private retreat than a backyard. Recent updates include a whole-home generator and a Class 4 impact-resistant roof less than three years old — the kind of details that matter as much as the finishes." },
        { type: "p", text: "This is a rare opportunity to own a meticulously maintained estate in one of Edmond's most private communities. If Saratoga Farms — or a lifestyle like it — is on your radar, I'd love to walk you through this home. Reach out anytime to schedule a private showing." },
      ],
    },
    {
      slug: "downtown-edmond",
      title: "Downtown Edmond: Living, Walking & Investing Near Broadway",
      category: "NEIGHBORHOOD GUIDE",
      post_date: "2026-08-05",
      excerpt: "What used to be a quiet stretch of Broadway has turned into one of the fastest-growing pockets of the metro — and for buyers, it's becoming one of the more interesting places to put down roots in Oklahoma.",
      localImage: "public/images/blog/downtown-edmond.jpg",
      body: [
        { type: "p", text: "If you haven't walked through Downtown Edmond lately, it's worth a trip. What used to be a quiet stretch of Broadway has turned into one of the fastest-growing pockets of the metro — and for buyers, it's becoming one of the more interesting places to put down roots in Oklahoma." },
        { type: "p", text: "Downtown is home to more than 75 shops and businesses, from Commonplace Books and Trinity Mercantile to Ellis Island Coffee and Wine Lounge and The Mule — the kind of independent, walkable retail mix you just don't find in most new-build suburbs. Add in year-round events like the Downtown Edmond Arts Festival, Heard on Hurd, and LibertyFest, and it's easy to see why this area has become the heart of the city rather than just its historic center." },
        { type: "p", text: "The growth isn't just retail. Downtown Edmond is in the middle of a real building boom — over 450 new Class A multifamily units, luxury “pocket neighborhoods” like The Ember adding more than 85 new homes within walking distance of Main Street, and a new boutique hotel and City Hall underway. All told, there's roughly $250 million in investment planned for the area over the next three years. That kind of momentum is a big part of why Edmond keeps getting named one of the fastest-growing cities in the state." },
        { type: "p", text: "For buyers, that means two things worth paying attention to: home values in and around Downtown have real room to keep climbing as the area builds out, and lifestyle-first buyers — young professionals, empty-nesters, anyone who wants to walk to dinner instead of drive — finally have inventory built specifically for them, not just older homes converted to fit the demand." },
        { type: "p", text: "One project I'm keeping a close eye on is The Townsend, a mixed-use infill development led by my friend Austin Tunnell of Building Culture. It's the kind of project that shows exactly where Downtown Edmond is headed — built with structural brick masonry meant to last generations, not just decades. Phase One is already under construction and will bring the Apollo Workspace coworking space, along with two live-work residences, with an opening anticipated next spring. It's a great example of the thoughtful, quality-first development happening just blocks from Broadway." },
        { type: "p", text: "It's also just genuinely easy living. You can grab coffee, get in a workout, browse a bookstore, and be home in under fifteen minutes on foot. For a metro that's spread out the way Oklahoma City is, that kind of density is rare — and it's a big reason Downtown Edmond keeps showing up on my clients' shortlists, whether they're buying their first home or their next investment property." },
        { type: "p", text: "It's also personal for me — my office and brokerage, The Agency, is right in the middle of it all in Downtown Edmond. I get to see this growth firsthand, day in and day out, which is part of why I'm so bullish on what's happening here." },
        { type: "p", text: "If Downtown Edmond's growth has you curious about what's available right now — or what a property here could be worth in a few years — I'm happy to talk through it." },
      ],
    },
    {
      slug: "legacy-at-covell",
      title: "The Legacy at Covell: Whole Foods, Shake Shack & More Coming to Edmond",
      category: "NEW DEVELOPMENT",
      post_date: "2026-08-06",
      excerpt: "After years of being talked about, The Legacy at Covell is finally happening — and it's shaping up to be one of the biggest retail developments Edmond has seen in a long time.",
      localImage: "public/images/blog/legacy-at-covell.jpg",
      body: [
        { type: "p", text: "If you drive past I-35 and Covell Road these days, you've probably noticed the dirt moving. After years of being talked about, The Legacy at Covell is finally happening — and it's shaping up to be one of the biggest retail developments Edmond has seen in a long time." },
        { type: "p", text: "Earlier this year, the Edmond City Council approved a $17 million incentive package to help land national retailers at the site, funded through the city's electric reserve. City estimates project roughly $100 million in sales from the priority tenants alone, with the public investment expected to pay for itself within four to five years. That's the kind of commitment that tells you this isn't just another strip center — it's meant to be a regional draw." },
        { type: "p", text: "So who's actually coming? Confirmed core tenants include Whole Foods, Cooper's Hawk Winery & Restaurant, Shake Shack, Texas Roadhouse, and Chipotle. There's also been buzz around other big names — Hobby Lobby, Barnes & Noble, Lululemon, and Flower Child have shown up on marketing site plans — but those aren't locked in yet, so take them as “possible” rather than “confirmed” for now." },
        { type: "p", text: "I'll admit Cooper's Hawk is the one I'm personally most excited about. I ate there a few times when I lived in Kansas City, and it quickly became one of my favorites — great wine, great food, and the kind of atmosphere that makes it an easy pick for a date night or a dinner with clients. Having it just minutes away here in Edmond is a genuine win." },
        { type: "p", text: "For homeowners and buyers near the Covell corridor, this matters more than it might seem at first glance. New grocery anchors, sit-down restaurants, and national retailers tend to lift nearby home values over time, both because of the added convenience and because they're a strong signal of where a city is investing next. Edmond clearly sees this corner of town as a priority, and that kind of public-private investment rarely happens without private development following close behind." },
        { type: "p", text: "Construction is already moving quickly, so this is one to watch over the next year. If you're weighing a purchase near Covell and I-35 — or wondering what a development like this could mean for a property you already own — I'm happy to talk through it." },
      ],
    },
    {
      slug: "neighborhood-provisions",
      title: "Neighborhood Provisions: Edmond's Award-Winning Local Favorite",
      category: "RESTAURANT FEATURE",
      post_date: "2026-08-07",
      excerpt: "Some restaurants are good. Neighborhood Provisions is the kind of place that makes you rethink what “good” even means in Edmond.",
      localImage: "public/images/blog/neighborhood-provisions.jpg",
      body: [
        { type: "p", text: "Some restaurants are good. Neighborhood Provisions is the kind of place that makes you rethink what “good” even means in Edmond. Since opening in 2022, it's become a genuine local institution — named a Top Recommended Restaurant in Edmond by The Oklahoman, with Executive Chef Jim Camp earning back-to-back recognition as a Top 5 Chef in the 405." },
        { type: "p", text: "Part of what makes it special is the setting. The restaurant sits along a golf course and lake, with floor-to-ceiling windows that frame the view from nearly every table. It's the kind of backdrop that makes an ordinary Tuesday dinner feel like an occasion — and it's exactly why I tell clients to request a window seat if they can." },
        { type: "p", text: "The food itself leans rustic and farm-to-table, with a seasonal menu that changes often and everything made from scratch. Regulars point to the grilled pork chops, braised short ribs, Thai chicken skewers, and the Texas Twinkie pizza as can't-miss orders, and the Sunday brunch has built a reputation of its own around here." },
        { type: "p", text: "If you're going for the first time, go on a weekday between 3 and 6pm and take advantage of happy hour — $4 draft beer, $5 wine by the glass, and $6 signature cocktails make it one of the better deals in Edmond for a spot this nice. The wine list alone is worth the trip; it's curated to offer real quality without the markup you'd expect at a restaurant with views like this." },
        { type: "p", text: "This is exactly the kind of local gem I love pointing out to clients moving to Edmond. It's not a chain, it's not trendy for the sake of it — it's a genuinely well-run restaurant that the neighborhood has claimed as its own, and that says a lot about the area around it." },
        { type: "p", text: "I've been here several times with my wife, Brooke, and I've also brought clients for lunch meetings — it works just as well for a date night as it does for business. I highly recommend it." },
        { type: "p", text: "If you haven't been, put it on your list. And if you have — I'd love to know what you ordered." },
      ],
    },
    {
      slug: "oak-tree",
      title: "Oak Tree: Golf Course Living in Edmond",
      category: "NEIGHBORHOOD GUIDE",
      post_date: "2026-08-10",
      excerpt: "Ask almost anyone in the Edmond real estate world to name the city's most prestigious address, and Oak Tree comes up fast.",
      localImage: "public/images/blog/oak-tree.jpg",
      body: [
        { type: "p", text: "Ask almost anyone in the Edmond real estate world to name the city's most prestigious address, and Oak Tree comes up fast. Sitting at the intersection of Kelly Avenue and Sorghum Mill Road, this gated, 24-hour-secured community has built a reputation over decades as Edmond's premier golf and country club neighborhood — and it's easy to see why once you're inside the gates." },
        { type: "p", text: "The centerpiece is 36 holes of championship golf split between two courses: Oak Tree National to the west and Oak Tree Golf & Country Club to the east. Oak Tree National has hosted major championships, including the 1988 PGA Championship and the 2006 Senior PGA Championship — this isn't just a neighborhood course, it's a genuine golf destination. Beyond the fairways, residents have access to the Ironwood Bar & Grill, tennis courts, a fitness center, and a pool, all woven into a lifestyle built around leisure and community." },
        { type: "p", text: "Homes here range widely, from around $250,000 up past $5 million, with a median sale price near $870,000 as of last year — up over 26% from the year before. Within Oak Tree, subdivisions like Turnberry, Cypress Point Estates, The Reserve, and the gated Oaks at Oak Tree each bring their own character, from traditional estate homes to newer custom builds, many backing directly onto the fairways." },
        { type: "p", text: "It's zoned to some of Edmond's top-rated schools — Cross Timbers Elementary, Sequoyah Middle School, and Edmond North High School — which makes it a strong pull for families as well as golf enthusiasts and empty-nesters looking to downsize without giving up space or luxury. And when you want to venture beyond the gates, favorites like Signature Grill, Cafe 501, and Gabriella's Italian Grill are all just minutes away, along with the Edmond Railyard and Icehouse Project food halls." },
        { type: "p", text: "Oak Tree isn't for everyone — it's a specific lifestyle built around golf, privacy, and a slower, more social pace. But for buyers who want that, there's really nothing else in the metro quite like it." },
        { type: "p", text: "I've spent a lot of time in Oak Tree myself over the years — I have some really good family friends who live inside the gates, and every time I'm there, I'm reminded how special that atmosphere and sense of community really is." },
        { type: "p", text: "If Oak Tree — or a lifestyle like it — is what you're after, I'd love to help you find the right fit inside the gates." },
      ],
    },
  ];

  await supabase.from("agent_site_posts").delete().eq("agent_site_id", site.id);
  for (const post of posts) {
    const imageUrl = await uploadFile(
      path.join(SITE_ROOT, post.localImage),
      `${site.id}/blog-${post.slug}.jpg`,
      "image/jpeg",
    );
    await supabase.from("agent_site_posts").insert({
      agent_site_id: site.id,
      slug: post.slug,
      title: post.title,
      category: post.category,
      post_date: post.post_date,
      excerpt: post.excerpt,
      image_url: imageUrl,
      body: post.body,
      status: "published",
    });
    console.log(`  ${post.slug} ✓`);
  }

  console.log("\nDone. View it at /sites/terrence-finchum once deployed (or on localhost).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
