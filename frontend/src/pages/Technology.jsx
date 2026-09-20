import { motion } from "framer-motion";
import {
  ArrowLeft,
  BrainCircuit,
  Cpu,
  Database,
  Drone,
  Eye,
  GitBranch,
  HardDrive,
  MonitorDown,
  Network,
  QrCode,
  RadioTower,
  Server,
  ShieldCheck,
  Workflow
} from "lucide-react";

import Button from "../components/Button";
import BotaoInstalador from "../components/BotaoInstalador";
import ScannerEffect from "../components/ScannerEffect";
import "../styles/Technology.css";
import "../styles/PublicUX.css";

export default function Technology({ setPage }) {
  return (
    <main className="technology-page">
      <section className="technology-hero">
        <button className="technology-back" onClick={() => setPage("home")}>
          <ArrowLeft size={18} />
          Voltar
        </button>

        <motion.div
          className="technology-hero-content"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="tag">Tecnologia</span>

          <h1>
            Uma arquitetura moderna para leitura com{" "}
            <strong>drone, QR Code e API</strong>.
          </h1>

          <p>
            Um aplicativo instalável que conversa direto com o drone,
            lê os QR Codes na própria máquina e sincroniza com a nuvem
            quando há internet — porque, dentro do galpão, quase nunca há.
          </p>

          <div className="technology-actions">
            <BotaoInstalador />
            <Button variant="secondary" onClick={() => setPage("about")}>
              Sobre o sistema
            </Button>
          </div>
        </motion.div>

        <motion.div
          className="technology-core" data-paralaxe="30"
          aria-hidden="true"
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="core-orbit orbit-one" />
          <div className="core-orbit orbit-two" />
          <div className="core-center">
            <BrainCircuit size={82} />
          </div>
          <div className="core-node node-1"><Drone /></div>
          <div className="core-node node-2"><QrCode /></div>
          <div className="core-node node-3"><Server /></div>
          <div className="core-node node-4"><Database /></div>
        </motion.div>
      </section>

      <section className="technology-section light">
        <div className="technology-title reveal">
          <span className="tag">Stack do projeto</span>
          <h2>Tecnologias usadas no sistema</h2>
          <p>
            Cada tecnologia tem uma função específica dentro da solução,
            mantendo o projeto separado, escalável e mais fácil de evoluir.
          </p>
        </div>

        <div className="technology-stack-grid escalonar">
          <TechCard
            icon={RadioTower}
            title="RTSP direto do drone"
            text="O computador entra na rede do próprio drone e recebe o vídeo por RTSP. Sem espelhar tela, sem aplicativo intermediário."
          />
          <TechCard
            icon={Cpu}
            title="Agent na borda"
            text="Um processo Python roda junto do operador e decide o que é leitura válida. A nuvem não alcança a rede fechada do drone — quem está perto precisa fazer o trabalho."
          />
          <TechCard
            icon={Eye}
            title="OpenCV + pyzbar"
            text="Seis tratamentos de imagem para a etiqueta sobreviver a sombra, reflexo e ao borrão do voo. O leitor começa pelo que funcionou no quadro anterior."
          />
          <TechCard
            icon={HardDrive}
            title="SQLite local"
            text="Cada leitura é gravada no disco antes de qualquer tentativa de rede, e sobe sozinha quando a internet volta. É o que faz o inventário sobreviver ao galpão."
          />
          <TechCard
            icon={Server}
            title="Node.js + Express"
            text="API que interpreta a etiqueta, organiza os registros e serve o painel."
          />
          <TechCard
            icon={Database}
            title="PostgreSQL + Supabase"
            text="Guarda empresas, setores, operações e o histórico de leituras."
          />
          <TechCard
            icon={MonitorDown}
            title="Electron"
            text="Empacota painel, API e Agent num instalador único. O operador abre um programa, não três terminais."
          />
          <TechCard
            icon={Cpu}
            title="React + Vite"
            text="Interface do painel, com tema claro e escuro e as telas de operação."
          />
        </div>
      </section>

      <section className="technology-flow-section">
        <div className="technology-flow-text reveal-esq">
          <span className="tag">Fluxo técnico</span>
          <h2>Como a informação percorre o sistema</h2>
          <p>
            A leitura nasce no vídeo do drone e é decidida ali mesmo, na
            máquina do operador. A nuvem entra depois — e só quando dá.
          </p>
        </div>

        <div className="technology-flow escalonar">
          <FlowStep number="01" icon={Drone} title="Drone" text="Transmite o vídeo por RTSP na rede dele." />
          <FlowLine />
          <FlowStep number="02" icon={Eye} title="Leitura" text="O Agent acha o QR e confirma em vários quadros." />
          <FlowLine />
          <FlowStep number="03" icon={HardDrive} title="Fila local" text="A leitura é gravada no disco na hora." />
          <FlowLine />
          <FlowStep number="04" icon={Network} title="Sincronismo" text="Sobe para a API assim que houver internet." />
          <FlowLine />
          <FlowStep number="05" icon={Database} title="Painel" text="O inventário aparece para a equipe." />
        </div>
      </section>

      <section className="technology-architecture">
        <div className="architecture-left reveal-esq">
          <span className="tag">Arquitetura</span>
          <h2>Cada parte com uma responsabilidade</h2>
          <p>
            O que exige estar perto do drone roda perto do drone; o que
            precisa ser consultado de qualquer lugar fica na nuvem. Essa
            divisão não é estética — é o que permite operar num galpão
            sem sinal e ainda assim ter o inventário no painel depois.
          </p>

          <div className="architecture-list">
            <ArchitectureItem icon={Cpu} title="Agent" text="Fala com o drone, lê os QR e guarda a fila local. Roda na borda." />
            <ArchitectureItem icon={MonitorDown} title="Aplicativo" text="Electron reunindo painel, API e Agent num instalador só." />
            <ArchitectureItem icon={Server} title="API" text="Node + Express: interpreta a etiqueta e é dona das regras." />
            <ArchitectureItem icon={GitBranch} title="Painel" text="React com as telas de operação, leituras e relatórios." />
          </div>
        </div>

        <div className="architecture-right reveal-dir">
          <ScannerEffect />
        </div>
      </section>

      <section className="technology-future light">
        <div className="technology-title reveal">
          <span className="tag">Em planejamento</span>
          <h2>Direções para a evolução da plataforma</h2>
          <p>Possibilidades para próximas versões. Estes recursos ainda não fazem parte da experiência atual.</p>
        </div>

        <div className="future-grid escalonar">
          <FutureCard icon={Database} title="Integração com ERP" text="Conectar o inventário aos sistemas de gestão da empresa." />
          <FutureCard icon={RadioTower} title="Painel ao vivo" text="Acompanhar o voo de outro computador, por WebSocket, sem esperar o fim da leitura." />
          <FutureCard icon={ShieldCheck} title="Auditoria de acesso" text="Ampliar o histórico de ações e a rastreabilidade das alterações." />
          <FutureCard icon={MonitorDown} title="Linux e macOS" text="Instaladores para as demais plataformas; hoje o pacote é de Windows." />
          <FutureCard icon={Workflow} title="Análises comparativas" text="Comparar inventários e acompanhar divergências ao longo do tempo." />
          <FutureCard icon={BrainCircuit} title="IA operacional" text="Análise de divergências e padrões de estoque." />
        </div>
      </section>

      <section className="public-next-step" aria-labelledby="technology-next-title">
        <div>
          <span className="tag">Da tecnologia à operação</span>
          <h2 id="technology-next-title">Avalie a solução no contexto da sua empresa</h2>
          <p>Apresente seu cenário à equipe para entender os requisitos de captura e integração.</p>
        </div>
        <Button onClick={() => setPage("contact")}>Falar sobre integração</Button>
      </section>
    </main>
  );
}

function TechCard({ icon: Icon, title, text }) {
  return (
    <motion.div
      className="tech-card"
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 180, damping: 20 }}
    >
      <Icon aria-hidden="true" />
      <h3>{title}</h3>
      <p>{text}</p>
    </motion.div>
  );
}

function FlowStep({ number, icon: Icon, title, text }) {
  return (
    <motion.div
      className="flow-step"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <span>{number}</span>
      <Icon aria-hidden="true" />
      <h3>{title}</h3>
      <p>{text}</p>
    </motion.div>
  );
}

function FlowLine() {
  return <div className="flow-line" aria-hidden="true" />;
}

function ArchitectureItem({ icon: Icon, title, text }) {
  return (
    <div className="architecture-item">
      <Icon aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

function FutureCard({ icon: Icon, title, text }) {
  return (
    <motion.div
      className="future-card"
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 180, damping: 20 }}
    >
      <Icon aria-hidden="true" />
      <h3>{title}</h3>
      <p>{text}</p>
    </motion.div>
  );
}
