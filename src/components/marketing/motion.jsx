import { motion } from "framer-motion";

// Shared entrance language for every marketing page (landing + the two
// product deep-dives) — one authored moment per section, reused, not
// reinvented per page. See DESIGN.md: "Motion is a light, single-direction
// reveal per section — not a decorative layer."
export const easeOut = [0.16, 1, 0.3, 1];

export const variants = {
  rise: {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } },
  },
  fromLeft: {
    hidden: { opacity: 0, x: -36 },
    show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: easeOut } },
  },
  fromRight: {
    hidden: { opacity: 0, x: 36 },
    show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: easeOut } },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.94 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: easeOut } },
  },
};

export function Reveal({ children, className, delay = 0, variant = "rise" }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants[variant]}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}
