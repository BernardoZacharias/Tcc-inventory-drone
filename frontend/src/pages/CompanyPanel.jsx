import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Play, QrCode, BarChart3 } from "lucide-react";
import { leiturasPorEmpresa } from "../services/api";
import { cardPop, stagger } from "../animations/motionVariants";
import "../styles/CompanyPanel.css";
import "../styles/Dashboard.css";

export default function CompanyPanel({ setPage, company }) {
  const [readings, setReadings] = useState([]);

  useEffect(() => {
    if (!company?.id) return;
    let active = true;
    async function load() {
      const r = await leiturasPorEmpresa(company.id);
      if (active && r?.success) setReadings(r.data || []);
    }
    load();
    const id = setInterval(load, 4000);
    return () => { active = false; clearInterval(id); };
  }, [company]);

  if (!company) {
    setPage("dashboard");
    return null;
  }

  return (
    <main className="company-page">
      <button className="back-action" onClick={() => setPage("dashboard")}>
        <ArrowLeft size={18} /> Voltar
      </button>

      <motion.section
        className="company-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div>
          <span className="tag">Empresa selecionada</span>
          <h1>{company.name}</h1>
          <p>{company.segment || "—"}</p>
        </div>

        <button className="start-reading" onClick={() => setPage("reading")}>
          <Play size={20} />
          Iniciar nova leitura
        </button>
      </motion.section>

      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="metric-card accent-cyan">
          <div className="metric-content">
            <span className="metric-title">Leituras</span>
            <strong className="metric-value">{readings.length}</strong>
          </div>
          <div className="metric-icon"><QrCode size={22} /></div>
        </div>
        <div className="metric-card accent-green">
          <div className="metric-content">
            <span className="metric-title">Última leitura</span>
            <strong className="metric-value" style={{ fontSize: 16 }}>
              {readings[0] ? new Date(readings[0].criado_em).toLocaleString() : "—"}
            </strong>
          </div>
          <div className="metric-icon"><BarChart3 size={22} /></div>
        </div>
        <div className="metric-card accent-violet">
          <div className="metric-content">
            <span className="metric-title">Status</span>
            <strong className="metric-value" style={{ fontSize: 18 }}>Operacional</strong>
          </div>
          <div className="metric-icon"><Play size={22} /></div>
        </div>
      </div>

      <section className="dashboard-panel">
        <div className="panel-header">
          <h2><QrCode size={18} /> Leituras recentes</h2>
        </div>

        <motion.div className="readings-list" variants={stagger} initial="hidden" animate="visible">
          {readings.length === 0 && <p className="empty-state">Nenhuma leitura registrada.</p>}

          {readings.map((reading) => (
            <motion.div className="reading-card" key={reading.id} variants={cardPop}>
              <div className="reading-icon">
                <QrCode size={22} />
              </div>
              <div>
                <strong>{reading.nome_produto || reading.codigo_qr || "Leitura"}</strong>
                <p>
                  {reading.produto_id ? `ID ${reading.produto_id} · ` : ""}
                  {reading.local_lido || "—"}
                </p>
              </div>
              <span>{reading.quantidade != null ? `${reading.quantidade} un` : reading.status}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </main>
  );
}
