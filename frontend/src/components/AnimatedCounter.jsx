import { motion, AnimatePresence } from "framer-motion";

// Big animated counter with per-digit slide animation
export default function AnimatedCounter({ value, className = "" }) {
  const digits = String(value).split("");
  return (
    <div
      data-testid="main-counter"
      className={`inline-flex items-baseline font-heading font-black tracking-tighter tabular-nums ${className}`}
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {digits.map((d, i) => (
          <motion.span
            key={`${digits.length}-${i}-${d}`}
            initial={{ y: 30, opacity: 0, filter: "blur(6px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: -30, opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block"
          >
            {d}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
