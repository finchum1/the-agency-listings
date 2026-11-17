import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from "framer-motion";

// A cursor-tracked glow, clipped to the card's own shape: it tells you the surface responds to you. Driven by motion
// values, not React state, so it costs nothing on re-render, and it doesn't move under reduced motion.
export default function SpotlightCard({ children, className = "" }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(-999);
  const my = useMotionValue(-999);
  const background = useMotionTemplate`radial-gradient(220px circle at ${mx}px ${my}px, rgba(237, 33, 39, 0.1), transparent 70%)`;

  function handleMove(e) {
    if (reduce) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  }
  function handleLeave() {
    mx.set(-999);
    my.set(-999);
  }

  return (
    <div onMouseMove={handleMove} onMouseLeave={handleLeave} className={`group relative overflow-hidden ${className}`}>
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
