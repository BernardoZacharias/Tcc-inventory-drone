import "../styles/Home.css";
import { motion } from "framer-motion";
import { Boxes, QrCode, Radar, ShieldCheck } from "lucide-react";

import SystemDroneVisual from "../components/SystemDroneVisual";
import ScannerEffect from "../components/ScannerEffect";
import BenefitCard from "../components/BenefitCard";
import Button from "../components/Button";
import BotaoInstalador from "../components/BotaoInstalador";
import { stagger, cardPop } from "../animations/motionVariants";

const CLEAN_EASE = [0.22, 1, 0.36, 1];

const cleanFadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.58, ease: CLEAN_EASE } },
};

const cleanFadeLeft = {
  hidden: { opacity: 0, x: -18 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.62, ease: CLEAN_EASE } },
};

const cleanScaleIn = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.62, ease: CLEAN_EASE },
  },
};

export default function Home({ setPage }) {
  return (
    <main className="home">

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-grid" />

        <div className="hero-content">
          <motion.div
            className="hero-text"
            variants={cleanFadeLeft}
            initial="hidden"
            animate="visible"
          >
            <span className="tag">Gestão logística inteligente</span>

            <h1>
              Inventário com <strong>Drone</strong>, QR Code e visão
              computacional.
            </h1>

            <p>
              Um aplicativo que lê as etiquetas direto do vídeo do drone,
              funciona mesmo sem internet no galpão e sincroniza o
              inventário com o painel quando a conexão volta.
            </p>

            <div className="hero-actions">
              <BotaoInstalador />

              <Button variant="secondary" onClick={() => setPage("technology")}>
                Conhecer Tecnologia
              </Button>
            </div>
          </motion.div>

          <SystemDroneVisual />
        </div>
      </section>

      {/* ── BENEFÍCIOS ── */}
      <section className="section">
        <motion.div
          className="section-title reveal"
          variants={cleanFadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <span className="tag">Por que usar drone?</span>
          <h2>Mais controle, velocidade e segurança no inventário</h2>
          <p>
            A solução combina logística, automação e visão computacional para
            reduzir falhas manuais e melhorar a conferência operacional.
          </p>
        </motion.div>

        <motion.div
          className="benefits-grid escalonar"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.div variants={cardPop}>
            <BenefitCard
              icon={QrCode}
              title="Leitura por QR Code"
              text="Identificação rápida de produtos, posições e pallets."
            />
          </motion.div>
          <motion.div variants={cardPop}>
            <BenefitCard
              icon={Radar}
              title="Captura aérea"
              text="Leitura visual com drone em áreas logísticas."
            />
          </motion.div>
          <motion.div variants={cardPop}>
            <BenefitCard
              icon={Boxes}
              title="Gestão por empresa"
              text="Cada cliente possui seu próprio histórico de leituras."
            />
          </motion.div>
          <motion.div variants={cardPop}>
            <BenefitCard
              icon={ShieldCheck}
              title="Menos risco operacional"
              text="Redução da necessidade de acesso manual a locais elevados."
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ── TECNOLOGIA / ARQUITETURA ── */}
      <section className="tech-section">
        <motion.div
          className="tech-text reveal-esq"
          variants={cleanFadeLeft}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <span className="tag">Arquitetura do sistema</span>
          <h2>Do drone até o painel de gestão</h2>
          <p>
            O drone transmite o vídeo, o Python processa a imagem, o backend
            registra as leituras e o front-end apresenta os dados por empresa.
          </p>

          <div className="flow escalonar">
            <div>Drone</div>
            <div>Python + OpenCV</div>
            <div>API Node</div>
            <div>Dashboard</div>
          </div>
        </motion.div>

        <motion.div
          variants={cleanScaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <ScannerEffect />
        </motion.div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="final-cta">
        <div className="final-cta-bg" />
        <motion.div
          className="final-cta-inner reveal"
          variants={cleanFadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2>Transforme inventário em inteligência operacional</h2>
          <p>
            Instale o aplicativo, conecte o drone e comece a contar. O painel
            recebe as leituras assim que houver internet.
          </p>
          <BotaoInstalador />
        </motion.div>
      </section>
    </main>
  );
}
