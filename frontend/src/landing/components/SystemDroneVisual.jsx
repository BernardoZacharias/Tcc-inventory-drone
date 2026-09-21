import { motion } from "framer-motion";
import { Drone } from "lucide-react";

import "../styles/SystemDroneVisual.css";

const ENTRY_EASE = [0.22, 1, 0.36, 1];

/**
 * Visual canônico do drone usado nas aberturas institucionais.
 * Home e Sobre compartilham o mesmo componente para não voltarem a
 * divergir em desenho, entrada, flutuação ou paralaxe.
 */
export default function SystemDroneVisual({ className = "" }) {
  return (
    <motion.div
      className={`system-drone-card ${className}`.trim()}
      data-paralaxe="30"
      aria-hidden="true"
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: ENTRY_EASE }}
    >
      <Drone size={110} />
      <div className="system-drone-light" />
    </motion.div>
  );
}
