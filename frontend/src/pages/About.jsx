import { motion } from "framer-motion";
import {
  ArrowLeft,
  BrainCircuit,
  Cpu,
  Database,
  Drone,
  Eye,
  HardDrive,
  QrCode,
  ShieldCheck,
  Warehouse
} from "lucide-react";

import Button from "../components/Button";
import BotaoInstalador from "../components/BotaoInstalador";
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
            Um aplicativo que o operador instala no computador, leva até o
            galpão e usa com o drone — inclusive onde não há internet. As
            leituras sobem para o painel assim que a conexão volta.
          </p>

          <div className="about-actions">
            <BotaoInstalador />
            <Button variant="secondary" onClick={() => setPage("technology")}>
              Entender a tecnologia
            </Button>
          </div>
        </motion.div>

        <motion.div
          className="about-drone-card" data-paralaxe="30"
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
        <div className="about-title reveal">
          <span className="tag">Como funciona</span>
          <h2>Do voo do drone até o painel de gestão</h2>
          <p>
            Para conversar com o drone, o computador entra na rede dele —
            uma rede sem internet. Por isso a leitura é decidida e guardada
            ali mesmo, e o envio para a nuvem vem depois.
          </p>
        </div>

        <div className="about-flow escalonar">
          <div className="about-flow-card">
            <Drone />
            <h3>Drone</h3>
            <p>Captura o vídeo da operação logística em tempo real.</p>
          </div>

          <div className="about-flow-card">
            <Eye />
            <h3>Leitura na borda</h3>
            <p>O Agent acha o QR no vídeo e só aceita o código depois de confirmá-lo em vários quadros.</p>
          </div>

          <div className="about-flow-card">
            <HardDrive />
            <h3>Fila local</h3>
            <p>Cada leitura é gravada no computador na hora, antes de qualquer tentativa de rede.</p>
          </div>

          <div className="about-flow-card">
            <Database />
            <h3>Painel na nuvem</h3>
            <p>Quando há internet, a fila sobe sozinha e o inventário aparece para a equipe.</p>
          </div>
        </div>
      </section>

      <section className="about-tech">
        <div className="about-tech-text reveal-esq">
          <span className="tag">Tecnologia aplicada</span>
          <h2>Arquitetura pensada para um sistema real</h2>

          <p>
            O aplicativo reúne painel, API e leitor num instalador só, mas
            por dentro cada parte continua separada. O leitor roda junto do
            drone, a API é dona das regras e o painel apenas apresenta —
            o que permite trocar de modelo de drone mexendo num arquivo.
          </p>

          <div className="about-tech-list">
            <div>
              <Cpu />
              <span>Leitura feita no computador do operador, sem depender da nuvem</span>
            </div>

            <div>
              <QrCode />
              <span>QR Code como identificador de estoque</span>
            </div>

            <div>
              <ShieldCheck />
              <span>Fila local: nenhuma leitura se perde sem internet</span>
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
        <div className="about-title reveal">
          <span className="tag">Benefícios</span>
          <h2>Por que essa solução é importante?</h2>
        </div>

        <div className="about-benefits-grid escalonar">
          <div className="about-benefit">
            <BrainCircuit />
            <h3>Funciona sem sinal</h3>
            <p>O galpão não precisa ter Wi-Fi. A leitura acontece no local e sincroniza depois.</p>
          </div>

          <div className="about-benefit">
            <ShieldCheck />
            <h3>Sem contagem dupla</h3>
            <p>Passar duas vezes pela mesma etiqueta não duplica o item no inventário.</p>
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
