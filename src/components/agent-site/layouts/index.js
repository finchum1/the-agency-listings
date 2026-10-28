import { BoldAreas, BoldBio, BoldBlog, BoldHero, BoldListings, BoldTestimonials } from "./Bold";
import { EditorialAreas, EditorialBio, EditorialBlog, EditorialHero, EditorialListings, EditorialTestimonials } from "./Editorial";
import { ListingsAreas, ListingsBio, ListingsBlog, ListingsHero, ListingsListings, ListingsTestimonials } from "./ListingsFirst";
import { GuideHero, LuxuryHero, WarmHero } from "./Concepts";
import { PortraitAreas, PortraitBio, PortraitBlog, PortraitHero, PortraitListings, PortraitTestimonials } from "./Portrait";

// The section components each non-classic layout swaps in (agent_sites.layout). A layout missing here (or "classic")
// uses the original components. Keep the keys in step with the check constraint on agent_sites.layout and SiteForm's
// LAYOUTS list.
export const LAYOUT_SECTIONS = {
  editorial: { Hero: EditorialHero, Bio: EditorialBio, Listings: EditorialListings, Testimonials: EditorialTestimonials, Areas: EditorialAreas, Blog: EditorialBlog },
  bold: { Hero: BoldHero, Bio: BoldBio, Listings: BoldListings, Testimonials: BoldTestimonials, Areas: BoldAreas, Blog: BoldBlog },
  portrait: { Hero: PortraitHero, Bio: PortraitBio, Listings: PortraitListings, Testimonials: PortraitTestimonials, Areas: PortraitAreas, Blog: PortraitBlog },
  luxury: { Hero: LuxuryHero },
  warm: { Hero: WarmHero },
  guide: { Hero: GuideHero },
  listings: { Hero: ListingsHero, Bio: ListingsBio, Listings: ListingsListings, Testimonials: ListingsTestimonials, Areas: ListingsAreas, Blog: ListingsBlog },
};

// Layouts whose home page opens on a light page rather than a photo, so the nav can't be clear-with-light-text there.
export const LIGHT_HERO_LAYOUTS = ["editorial", "portrait", "guide"];

// Layouts that show only a short version of a section on Home and want the regular full one on its own page.
export const FULL_SECTION_ON_OWN_PAGE = { listings: ["Bio"] };

// Layouts that pull the listings to the top of Home, straight after the hero.
export const LISTINGS_FIRST_LAYOUTS = ["listings"];
