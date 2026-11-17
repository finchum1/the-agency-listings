// Guards the agent-site hero rule: the agent's profile photo may stand in for a missing hero PHOTO, but never when the site has a hero VIDEO
// (it would be shown as the video's poster: a flash of the headshot before the video starts). Run: node scripts/check-hero-fallback.mjs
import { register } from "node:module";
register("./_resolve-ext.mjs", import.meta.url);
const { adaptAgentSite } = await import("../src/lib/adaptAgentSite.js");

const agent = { id: "a1", full_name: "Test Agent", photo_url: "https://example.test/headshot.jpg" };
const adapt = (site) => adaptAgentSite({ site: { slug: "t", ...site }, agent, testimonials: [], areas: [], posts: [], listings: [], sales: [] });
const cases = [
  ["video only: no headshot poster", { hero_video_url: "https://example.test/v.mp4" }, ""],
  ["video and photo: the photo is the poster", { hero_video_url: "https://example.test/v.mp4", hero_photo_url: "https://example.test/hero.jpg" }, "https://example.test/hero.jpg"],
  ["photo only: the photo", { hero_photo_url: "https://example.test/hero.jpg" }, "https://example.test/hero.jpg"],
  ["neither: the profile photo stands in (as designed)", {}, "https://example.test/headshot.jpg"],
];
let failed = 0;
for (const [name, site, want] of cases) {
  let got;
  try {
    got = adapt(site).heroPhoto;
  } catch (e) {
    got = `threw: ${e.message}`;
  }
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
}
process.exit(failed ? 1 : 0);
