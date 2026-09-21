import { useState } from "react";
import { motion } from "framer-motion";
import { Radar, Plus, Trash2, CheckCircle2, XCircle, PlayCircle } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { toast } from "../../shared/services/toast";
import {
  listarOperacoes,
  criarOperacao,
  setOperacaoStatus,
  excluirOperacao,
  listarEmpresas
} from "../../shared/services/api";
import { cardPop, stagger } from "../../shared/animations/motionVariants";
import { useOperationalData } from "../hooks/useOperationalData";
import { useOperationalAction } from "../hooks/useOperationalAction";
import { OperationsFeedback, OperationsSearch } from "../components/OperationsFeedback";
import "../styles/Dashboard.css";
import "../styles/Pages.css";

const STATUS_COLOR = {
  agendada:     "tag-blue",
  em_andamento: "tag-cyan",
  concluida:    "tag-green",
  cancelada:    "tag-red"
};
const STATUS_LABEL = { agendada: "Agendada", em_andamento: "Em andamento", concluida: "Concluída", cancelada: "Cancelada" };
const FETCHERS = [listarOperacoes, listarEmpresas];

export default function Operations({ setPage }) {
  const { data: [list, empresas], loading, error, updatedAt, refresh: load } = useOperationalData(FETCHERS);
  const { pending, act } = useOperationalAction();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({
    empresa_id: "", titulo: "", descricao: "", piloto: "", area_voo: ""
  });

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!form.empresa_id) { toast.error("Selecione uma empresa"); return; }
    if (!form.titulo.trim()) { toast.error("Informe o título da operação"); return; }
    if (await act("create", () => criarOperacao({ ...form, titulo: form.titulo.trim() }), "Operação criada")) {
      setForm({ empresa_id: "", titulo: "", descricao: "", piloto: "", area_voo: "" });
      load();
    }
  }

  async function handleStatus(id, status) {
    if (await act(`status-${id}`, () => setOperacaoStatus(id, status), `Operação atualizada: ${STATUS_LABEL[status]}`)) load();
  }

  async function handleDelete(id, title) {
    if (!window.confirm(`Excluir a operação "${title}"? Esta ação não pode ser desfeita.`)) return;
    if (await act(`delete-${id}`, () => excluirOperacao(id), "Operação removida")) load();
  }

  const filtered = list.filter((operation) => (!statusFilter || operation.status === statusFilter)
    && [operation.titulo, operation.empresa_nome, operation.piloto, operation.area_voo].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))));

  return (
    <main className="dashboard operations-page">
      <Sidebar active="operations" setPage={setPage} />

      <section className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <span className="tag">Centro de operações</span>
            <h1>Voos &amp; missões</h1>
            <p>Gerencie operações em andamento, agendadas e concluídas.</p>
          </div>
        </div>

        <OperationsFeedback loading={loading} error={error} updatedAt={updatedAt} onRetry={load} />
        <div className="two-col">
          <form className="panel-box form-panel" onSubmit={handleCreate}>
            <h2><Plus size={18} /> Nova operação</h2>
            <p className="form-note">Defina a empresa e o título para registrar uma missão. Campos com * são obrigatórios.</p>

            <label htmlFor="operation-company">Empresa *</label>
            <select id="operation-company" required name="empresa_id" value={form.empresa_id} onChange={handleChange}>
              <option value="">Selecione uma empresa</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
            {!loading && !error && empresas.length === 0 && <p className="form-note">Cadastre uma empresa antes de criar uma operação.</p>}

            <label htmlFor="operation-title">Título *</label>
            <input id="operation-title" required name="titulo" value={form.titulo} onChange={handleChange}
                   placeholder="Inventário corredor A" />

            <label htmlFor="operation-description">Descrição</label>
            <textarea id="operation-description" name="descricao" value={form.descricao} onChange={handleChange}
                      placeholder="Observações da operação..." />

            <label htmlFor="operation-pilot">Piloto</label>
            <input id="operation-pilot" name="piloto" value={form.piloto} onChange={handleChange}
                   placeholder="Nome do operador" />

            <label htmlFor="operation-area">Área de voo</label>
            <input id="operation-area" name="area_voo" value={form.area_voo} onChange={handleChange}
                   placeholder="Setor / corredor" />

            <button className="btn-submit" type="submit" disabled={Boolean(pending) || empresas.length === 0}>
              {pending === "create" ? "Salvando..." : "Criar operação"}
            </button>
          </form>

          <div className="panel-box">
            <h2><Radar size={18} /> Operações registradas</h2>
            <div className="operations-filter-row">
              <OperationsSearch value={search} onChange={setSearch} label="Buscar operação" placeholder="Título, empresa, piloto ou área" />
              <select aria-label="Filtrar operações por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>

            <motion.div
              className="op-list"
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              {!loading && !error && filtered.length === 0 && (
                <p className="empty-state">{search || statusFilter ? "Nenhuma operação corresponde aos filtros." : "Nenhuma operação cadastrada. Crie sua primeira missão no formulário."}</p>
              )}

              {filtered.map((o) => (
                <motion.div className="op-card" key={o.id} variants={cardPop}>
                  <div className="op-card-head">
                    <strong>{o.titulo}</strong>
                    <span className={`pill ${STATUS_COLOR[o.status] || ""}`}>
                      {STATUS_LABEL[o.status] || "Status não informado"}
                    </span>
                  </div>
                  <p className="op-meta">
                    {o.empresa_nome || "Empresa removida"} · {o.area_voo || "—"} · Piloto: {o.piloto || "—"}
                  </p>
                  {o.descricao && <p className="op-desc">{o.descricao}</p>}

                  <div className="op-actions">
                    {o.status !== "em_andamento" && (
                      <button disabled={Boolean(pending)} onClick={() => handleStatus(o.id, "em_andamento")} title="Retomar">
                        <PlayCircle size={14} /> Em andamento
                      </button>
                    )}
                    {o.status !== "concluida" && (
                      <button disabled={Boolean(pending)} onClick={() => handleStatus(o.id, "concluida")} title="Concluir">
                        <CheckCircle2 size={14} /> Concluir
                      </button>
                    )}
                    {o.status !== "cancelada" && (
                      <button disabled={Boolean(pending)} onClick={() => handleStatus(o.id, "cancelada")} title="Cancelar" className="danger">
                        <XCircle size={14} /> Cancelar
                      </button>
                    )}
                    <button disabled={Boolean(pending)} onClick={() => handleDelete(o.id, o.titulo)} aria-label={`Excluir operação ${o.titulo}`} title="Excluir" className="danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
}
