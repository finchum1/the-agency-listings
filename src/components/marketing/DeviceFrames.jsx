import { motion } from "framer-motion";
import { easeOut } from "./motion";

// Signature proof device #1 (see DESIGN.md "Browser Frame") — a rounded,
// bordered, white-chrome container with three traffic-light dots over any
// full-bleed screenshot. Proves a screen is real, not a mockup. Reused
// across every marketing page — don't reuse it to frame arbitrary images
// elsewhere in the product.
export function BrowserFrame({ src, alt, className }) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className={`rounded-xl overflow-hidden border border-black/10 bg-white shadow-2xl shadow-black/20 ${className || ""}`}
    >
      <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#f1efe9] border-b border-black/5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e4574c]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e8b23d]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#3fae5c]" />
      </div>
      <img src={src} alt={alt} className="w-full h-auto block" />
    </motion.div>
  );
}

// Signature proof device #2 — same family as BrowserFrame (soft shadow,
// white chrome, proof-of-real intent) sized for a phone screenshot
// instead of a desktop one. Used wherever a page proves "this works on
// mobile too," which both new product deep-dives do.
export function PhoneFrame({ src, alt, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, rotateY: -18, scale: 0.92 }}
      whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease: easeOut }}
      style={{ perspective: 1000 }}
      className={`mx-auto w-full max-w-[280px] rounded-[2.25rem] border-[6px] border-[#1c1a17] bg-[#1c1a17] shadow-2xl shadow-black/25 overflow-hidden ${className || ""}`}
    >
      <div className="relative rounded-[1.65rem] overflow-hidden bg-white">
        <div className="absolute top-0 inset-x-0 h-6 flex items-center justify-center z-10">
          <span className="h-4 w-20 rounded-full bg-[#1c1a17]" />
        </div>
        <img src={src} alt={alt} className="w-full h-auto block" />
      </div>
    </motion.div>
  );
}
