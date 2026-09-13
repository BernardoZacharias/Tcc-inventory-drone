export const fadeUp = {
  hidden:  { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } }
};

export const fadeLeft = {
  hidden:  { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.8, ease: "easeOut" } }
};

export const fadeRight = {
  hidden:  { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.8, ease: "easeOut" } }
};

export const scaleIn = {
  hidden:  { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: "easeOut" } }
};

export const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } }
};

export const cardPop = {
  hidden:  { opacity: 0, y: 22, scale: 0.96 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
};

export const glowPulse = {
  animate: {
    boxShadow: [
      "0 0 0 rgba(0,213,255,0.0)",
      "0 0 30px rgba(0,213,255,0.45)",
      "0 0 0 rgba(0,213,255,0.0)"
    ],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
  }
};
