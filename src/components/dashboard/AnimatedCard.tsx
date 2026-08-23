"use client";

import { useEffect, useState } from "react";
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
  // Filet de sécurité : la carte part à `opacity: 0` mais occupe déjà sa place.
  // Si l'IntersectionObserver ne se déclenche jamais — cas observé dans les
  // navigateurs intégrés (Instagram, LinkedIn) et sur une page restaurée depuis
  // le bfcache — elle resterait transparente, et les boutons qu'elle contient
  // invisibles donc réputés « morts ». Passé ce délai, on affiche quoi qu'il
  // arrive : l'animation reste nominale, seul son échec est neutralisé.
  const [forceVisible, setForceVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setForceVisible(true), 1200);
    return () => clearTimeout(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      animate={forceVisible ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className={`card-cal p-5 sm:p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}
