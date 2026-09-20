import "../styles/Home.css";
import "../styles/DroneHero.css";
import { motion } from "framer-motion";
import { Boxes, BrainCircuit, QrCode, Radar, ShieldCheck } from "lucide-react";

import Navbar from "../components/Navbar";
import DroneAnimation from "../components/DroneAnimation";
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
      <Navbar setPage={setPage} current="home" />

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

          <motion.div
            className="hero-visual"
            variants={cleanScaleIn}
            initial="hidden"
            animate="visible"
          >
            <DroneAnimation />
          </motion.div>
        </div>
      </section>

      {/* ── BENEFÍCIOS ── */}
      <section className="section">
        <motion.div
          className="section-title"
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
          className="benefits-grid"
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
          className="tech-text"
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

          <div className="flow">
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
          className="final-cta-inner"
          variants={cleanFadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <BrainCircuit size={42} />
          <h2>Transforme inventário em inteligência operacional</h2>
          <p>
            Controle leituras, empresas e operações em uma interface moderna e
            preparada para expansão.
          </p>
          <Button onClick={() => setPage("login")}>Entrar no sistema</Button>
        </motion.div>
      </section>
    </main>
  );
}
