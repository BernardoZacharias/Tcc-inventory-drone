import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellRing, Check, Trash2, AlertTriangle, Info } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { toast } from "../../shared/services/toast";
import {
  listarAlertas,
  marcarAlertaLido,
  excluirAlerta,
  criarAlerta,
  listarEmpresas
} from "../../shared/services/api";
import { beepAlerta } from "../utils/beep";
import { cardPop, stagger } from "../../shared/animations/motionVariants";
import { useOperationalData } from "../hooks/useOperationalData";
import { useOperationalAction } from "../hooks/useOperationalAction";
import { OperationsFeedback, OperationsSearch } from "../components/OperationsFeedback";
import "../styles/Dashboard.css";
import "../styles/Pages.css";

const ICON = {
  info:    Info,
  aviso:   BellRing,
  critico: AlertTriangle
};
const FETCHERS = [listarAlertas, listarEmpresas];
const TYPE_LABEL = { info: "Informação", aviso: "Aviso", critico: "Crítico" };
const isRead = (alert) => alert.lido === true || alert.lido === 1 || alert.lido === "1" || alert.lido === "true";

export default function Alerts({ setPage }) {
  const { data: [list, empresas], loading, error, updatedAt, refresh: load } = useOperationalData(FETCHERS, { interval: 5000 });
  const { pending, act } = useOperationalAction();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [form, setForm] = useState({ empresa_id: "", tipo: "info", mensagem: "" });
  const lastIdRef = useRef(0);

  useEffect(() => {
      const newestId = Math.max(0, ...list.map((alert) => Number(alert.id) || 0));
      if (lastIdRef.current && newestId > lastIdRef.current) {
        const recente = list.find((x) => Number(x.id) === newestId);
        if (recente?.tipo === "critico") beepAlerta();
      }
      lastIdRef.current = newestId;
  }, [list]);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!form.mensagem.trim()) { toast.error("Digite a mensagem do alerta"); return; }
    if (await act("create", () => criarAlerta({ ...form, mensagem: form.mensagem.trim() }), "Alerta registrado")) {
      setForm({ empresa_id: "", tipo: "info", mensagem: "" });
      load();
    }
  }

  const unread = list.filter((alert) => !isRead(alert)).length;
  const filtered = list.filter((alert) => (filter === "todos" || (filter === "pendentes" ? !isRead(alert) : alert.tipo === "critico"))
    && [alert.mensagem, alert.empresa_nome].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))));

  return (
    <main className="dashboard operations-page">
      <Sidebar active="alerts" setPage={setPage} />

      <section className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <span className="tag">Notificações</span>
            <h1>Alertas operacionais</h1>
            <p>Eventos críticos e avisos da operação em tempo real.</p>
          </div>
        </div>

        <OperationsFeedback loading={loading && !updatedAt} error={error} updatedAt={updatedAt} onRetry={load} />
        <div className="two-col">
          <form className="panel-box form-panel" onSubmit={handleCreate}>
            <h2><Bell size={18} /> Novo alerta</h2>

            <label htmlFor="alert-company">Empresa</label>
            <select id="alert-company" name="empresa_id" value={form.empresa_id} onChange={handleChange}>
              <option value="">— Geral —</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>

            <label htmlFor="alert-type">Tipo</label>
            <select id="alert-type" name="tipo" value={form.tipo} onChange={handleChange}>
              <option value="info">Informação</option>
              <option value="aviso">Aviso</option>
              <option value="critico">Crítico</option>
            </select>

            <label htmlFor="alert-message">Mensagem *</label>
            <textarea id="alert-message" required name="mensagem" value={form.mensagem} onChange={handleChange}
                      placeholder="Descreva o evento..." />

            <button className="btn-submit" type="submit" disabled={Boolean(pending)}>{pending === "create" ? "Registrando…" : "Registrar alerta"}</button>
          </form>

          <div className="panel-box">
            <h2><BellRing size={18} /> Caixa de alertas {updatedAt && <span className="count-badge">{unread} não lidos</span>}</h2>
            <OperationsSearch value={search} onChange={setSearch} label="Buscar alerta" placeholder="Mensagem ou empresa" />
            <div className="operations-filter-row">
              <div className="filter-tabs" role="group" aria-label="Filtrar alertas">
                {[["todos", "Todos"], ["pendentes", "Não lidos"], ["criticos", "Críticos"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}
              </div>
            </div>

            <motion.div className="alert-list" variants={stagger} initial="hidden" animate="visible">
              {!loading && !error && filtered.length === 0 && <p className="empty-state">{search || filter !== "todos" ? "Nenhum alerta corresponde aos filtros." : "Nenhum alerta registrado. Novos eventos aparecerão aqui."}</p>}

              {filtered.map((a) => {
                const Ico = ICON[a.tipo] || Bell;
                return (
                  <motion.div className={`alert-card alert-${a.tipo}${isRead(a) ? " read" : ""}`}
                              key={a.id} variants={cardPop}>
                    <Ico size={18} className="alert-ico" />
                    <div className="alert-body">
                      <p>{a.mensagem}</p>
                      <span className="alert-meta">
                        {TYPE_LABEL[a.tipo] || "Alerta"} · {isRead(a) ? "Lido" : "Não lido"} · {a.empresa_nome || "Geral"} · {new Date(a.criado_em).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="alert-actions">
                      {!isRead(a) && (
                        <button
                          className="icon-btn"
                          disabled={Boolean(pending)}
                          onClick={async () => {
                            if (await act(`read-${a.id}`, () => marcarAlertaLido(a.id), "Alerta marcado como lido")) load();
                          }}
                          title="Marcar como lido"
                          aria-label={`Marcar como lido: ${a.mensagem}`}
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        className="icon-btn danger"
                        disabled={Boolean(pending)}
                        onClick={async () => {
                          if (!window.confirm(`Excluir o alerta "${a.mensagem}"? Esta ação não pode ser desfeita.`)) return;
                          if (await act(`delete-${a.id}`, () => excluirAlerta(a.id), "Alerta removido")) load();
                        }}
                        title="Excluir"
                        aria-label={`Excluir alerta: ${a.mensagem}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
}
