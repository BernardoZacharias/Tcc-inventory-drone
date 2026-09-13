import { motion } from "framer-motion";
import {
  ArrowLeft,
  BrainCircuit,
  Cpu,
  Database,
  Drone,
  Eye,
  Network,
  QrCode,
  ShieldCheck,
  Warehouse
} from "lucide-react";

import Button from "../components/Button";
import Navbar from "../components/Navbar";
import ScannerEffect from "../components/ScannerEffect";
import "../styles/About.css";
import "../styles/PublicUX.css";

export default function About({ setPage }) {
  return (
    <main className="about-page">
      <Navbar setPage={setPage} current="about" />
      <section className="about-hero">
        <button className="about-back" onClick={() => setPage("home")}>
          <ArrowLeft size={18} />
          Voltar
        </button>

        <motion.div
          className="about-hero-content"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="tag">Sobre o sistema</span>

          <h1>
            Plataforma inteligente para inventário físico com{" "}
            <strong>drone e QR Code</strong>.
          </h1>

          <p>
            O sistema foi desenvolvido para automatizar processos de inventário,
            reduzir erros operacionais e permitir que diferentes empresas sejam
            gerenciadas em uma única plataforma.
          </p>

          <div className="about-actions">
            <Button onClick={() => setPage("login")}>Acessar sistema</Button>
            <Button variant="secondary" onClick={() => setPage("technology")}>
              Entender a tecnologia
            </Button>
          </div>
        </motion.div>

        <motion.div
          className="about-drone-card"
          aria-hidden="true"
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <Drone size={110} />
          <div className="about-drone-light" />
        </motion.div>
      </section>

      <section className="about-section">
        <div className="about-title">
          <span className="tag">Como funciona</span>
          <h2>Do voo do drone até o painel de gestão</h2>
          <p>
            A solução é dividida em módulos independentes, criando uma
            arquitetura moderna, escalável e fácil de integrar com o front-end.
          </p>
        </div>

        <div className="about-flow">
          <div className="about-flow-card">
            <Drone />
            <h3>Drone</h3>
            <p>Captura o vídeo da operação logística em tempo real.</p>
          </div>

          <div className="about-flow-card">
            <Eye />
            <h3>Visão Computacional</h3>
            <p>O Python com OpenCV analisa a imagem e identifica QR Codes.</p>
          </div>

          <div className="about-flow-card">
            <Network />
            <h3>API Node</h3>
            <p>Recebe as leituras, organiza os dados e entrega para o sistema.</p>
          </div>

          <div className="about-flow-card">
            <Database />
            <h3>Banco de Dados</h3>
            <p>Armazena histórico, empresas, produtos e leituras realizadas.</p>
          </div>
        </div>
      </section>

      <section className="about-tech">
        <div className="about-tech-text">
          <span className="tag">Tecnologia aplicada</span>
          <h2>Arquitetura pensada para um sistema real</h2>

          <p>
            Visão computacional, backend e interface trabalham em módulos
            separados. As leituras são registradas no PostgreSQL e consultadas
            no painel, com autenticação e organização por empresa. Essa base
            permite evoluir cada etapa sem redesenhar toda a operação.
          </p>

          <div className="about-tech-list">
            <div>
              <Cpu />
              <span>Python + OpenCV para leitura visual</span>
            </div>

            <div>
              <QrCode />
              <span>QR Code como identificador de estoque</span>
            </div>

            <div>
              <ShieldCheck />
              <span>API separada para controle e segurança</span>
            </div>

            <div>
              <Warehouse />
              <span>Gestão por empresa e operação logística</span>
            </div>
          </div>
        </div>

        <ScannerEffect />
      </section>

      <section className="about-benefits">
        <div className="about-title">
          <span className="tag">Benefícios</span>
          <h2>Por que essa solução é importante?</h2>
        </div>

        <div className="about-benefits-grid">
          <div className="about-benefit">
            <BrainCircuit />
            <h3>Automação</h3>
            <p>Reduz atividades manuais e aumenta a velocidade do inventário.</p>
          </div>

          <div className="about-benefit">
            <ShieldCheck />
            <h3>Menos erros</h3>
            <p>Ajuda a evitar falhas de digitação, conferência e localização.</p>
          </div>

          <div className="about-benefit">
            <Warehouse />
            <h3>Controle por empresa</h3>
            <p>Cada cliente pode ter seu próprio painel e histórico de leituras.</p>
          </div>

          <div className="about-benefit">
            <QrCode />
            <h3>Rastreabilidade</h3>
            <p>Permite acompanhar quando e onde cada item foi identificado.</p>
          </div>
        </div>
      </section>

      <section className="public-next-step" aria-labelledby="about-next-title">
        <div>
          <span className="tag">Próximo passo</span>
          <h2 id="about-next-title">Como isso se aplica ao seu inventário?</h2>
          <p>Converse com a equipe sobre o ambiente, a identificação dos itens e o fluxo da sua operação.</p>
        </div>
        <Button onClick={() => setPage("contact")}>Conversar com a equipe</Button>
      </section>
    </main>
  );
}
