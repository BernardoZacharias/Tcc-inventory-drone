import { motion } from "framer-motion";
import "../styles/ScannerEffect.css";

/*
 * ScannerEffect
 * ─────────────
 * Efeito visual de "scanner" usado na Home, ReadingPanel, About,
 * Technology e Contact. Usa classes isoladas com prefixo .gv-scan
 * para nunca depender de CSS de outra página (correção do efeito
 * que ficava quebrado/sem estilo).
 */
export default function ScannerEffect() {
  return (
    <div className="gv-scan">
      <div className="gv-scan-grid" />

      <motion.div
        className="gv-scan-line"
        animate={{ top: ["6%", "92%", "6%"] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
      />

      <div className="gv-scan-corner tl" />
      <div className="gv-scan-corner tr" />
      <div className="gv-scan-corner bl" />
      <div className="gv-scan-corner br" />

      <div className="gv-scan-frame" />
      <div className="gv-scan-glow" />
    </div>
  );
}
