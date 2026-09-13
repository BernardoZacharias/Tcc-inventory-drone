import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { QrCode, Search, ScanLine, Package, AlertTriangle, Boxes } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { listarLeituras } from "../services/api";
import { computeReadingStats, localDateKey } from "../utils/readingStats";
import { useOperationalData } from "../hooks/useOperationalData";
import { OperationsFeedback } from "../components/OperationsFeedback";
import { cardPop, stagger } from "../animations/motionVariants";
import "../styles/Dashboard.css";
import "../styles/Pages.css";

const FETCHERS = [listarLeituras];

export default function Readings({ setPage }) {
  const { data: [readings], loading, error, updatedAt, refresh } = useOperationalData(FETCHERS, { interval: 3000 });
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("todos"); // todos | frageis | hoje

  const stats = useMemo(() => computeReadingStats(readings), [readings]);
  const hojeIso = localDateKey(new Date());
  const metric = (value) => updatedAt ? Number(value).toLocaleString("pt-BR") : "—";

  const filtered = useMemo(() => {
    let list = readings;
    if (filtro === "frageis") {
      list = list.filter((r) => String(r.fragil).toLowerCase() === "sim");
    } else if (filtro === "hoje") {
      list = list.filter(
        (r) => localDateKey(r.data_hora_leitura || r.criado_em) === hojeIso
      );
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.nome_produto || "").toLowerCase().includes(q) ||
          String(r.produto_id || "").toLowerCase().includes(q) ||
          (r.empresa || "").toLowerCase().includes(q) ||
          (r.local_lido || "").toLowerCase().includes(q) ||
          (r.operador || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [readings, search, filtro, hojeIso]);

  return (
    <main className="dashboard operations-page">
      <Sidebar active="readings" setPage={setPage} />

      <section className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <span className="tag">Captura em tempo real</span>
            <h1>Leituras de QR Code</h1>
            <p>Consulte produtos, locais e responsáveis. As leituras são atualizadas automaticamente.</p>
          </div>
          {/* Botão claro para iniciar nova leitura */}
          <button className="btn-new-reading" onClick={() => setPage("reading")}>
            <ScanLine size={18} />
            Nova leitura
          </button>
        </div>

        <OperationsFeedback loading={loading && !updatedAt} error={error} updatedAt={updatedAt} onRetry={refresh} />
        {/* Resumo estruturado */}
        <div className="reading-summary">
          <div className="rsum-item">
            <QrCode size={16} />
            <div><strong>{metric(stats.total)}</strong><span>Leituras</span></div>
          </div>
          <div className="rsum-item">
            <Boxes size={16} />
            <div><strong>{metric(stats.quantidade_total)}</strong><span>Itens lidos</span></div>
          </div>
          <div className="rsum-item">
            <Package size={16} />
            <div><strong>{metric(stats.produtos_distintos)}</strong><span>Produtos</span></div>
          </div>
          <div className="rsum-item warn">
            <AlertTriangle size={16} />
            <div><strong>{metric(stats.itens_frageis)}</strong><span>Frágeis</span></div>
          </div>
        </div>

        <div className="panel-box readings-panel">
          <div className="panel-header">
            <h2><QrCode size={18} /> {updatedAt ? `${filtered.length} leituras` : "Histórico de leituras"}</h2>
            <div className="readings-tools">
              <div className="filter-tabs" role="group" aria-label="Filtrar leituras">
                <button aria-pressed={filtro === "todos"} className={filtro === "todos" ? "active" : ""} onClick={() => setFiltro("todos")}>Todas</button>
                <button aria-pressed={filtro === "hoje"} className={filtro === "hoje" ? "active" : ""} onClick={() => setFiltro("hoje")}>Hoje</button>
                <button aria-pressed={filtro === "frageis"} className={filtro === "frageis" ? "active" : ""} onClick={() => setFiltro("frageis")}>Frágeis</button>
              </div>
              <div className="search-wrap">
                <Search size={14} />
                <input
                  type="search" aria-label="Buscar leituras por produto, local ou operador"
                  placeholder="Buscar produto, local, operador..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <motion.div className="readings-grid" variants={stagger} initial="hidden" animate="visible">
            {!loading && !error && filtered.length === 0 && (
              <p className="empty-state">
                {search || filtro !== "todos" ? "Nenhuma leitura corresponde aos filtros." : "Nenhuma leitura registrada. Use Nova leitura para começar."}
                {(search || filtro !== "todos") && <button className="operations-empty-action" onClick={() => { setSearch(""); setFiltro("todos"); }}>Limpar filtros</button>}
              </p>
            )}

            {filtered.map((r) => (
              <motion.div className="reading-struct-card" key={r.id} variants={cardPop}>
                <div className="rs-head">
                  <Package size={16} />
                  <strong>{r.nome_produto || r.codigo_qr || "Leitura"}</strong>
                  {String(r.fragil).toLowerCase() === "sim" && (
                    <span className="rs-fragil"><AlertTriangle size={11} /> Frágil</span>
                  )}
                </div>
                <div className="rs-body">
                  <span>ID: <b>{r.produto_id || "—"}</b></span>
                  <span>Qtd: <b>{r.quantidade ?? "—"}</b></span>
                  <span>Empresa: <b>{r.empresa || r.empresa_qr || "—"}</b></span>
                  <span>Local: <b>{r.local_lido || "—"}</b></span>
                  <span>Setor: <b>{r.setor || "—"}</b></span>
                  <span>Operador: <b>{r.operador || "—"}</b></span>
                </div>
                <div className="rs-foot">
                  <span className="pill tag-cyan">{r.status}</span>
                  <small>{new Date(r.data_hora_leitura || r.criado_em).toLocaleString()}</small>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </main>
  );
}
