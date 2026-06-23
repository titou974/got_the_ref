"use client";

import { motion } from "framer-motion";

/** Carte animée façon cal.com : entrée en fondu + lift au survol (via .card-cal). */
export function AnimatedCard({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className={`card-cal p-5 sm:p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}
