import { motion } from "framer-motion";

export default function BenefitCard({ icon: Icon, title, text }) {
  return (
    <motion.div
      className="benefit-card"
      whileHover={{
        y: -8,
        scale: 1.03
      }}
      transition={{ type: "spring", stiffness: 200 }}
    >
      <div className="benefit-icon">
        <Icon size={32} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </motion.div>
  );
}