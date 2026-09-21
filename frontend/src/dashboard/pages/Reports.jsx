import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Trash2, Download } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { toast } from "../../shared/services/toast";
import {
  listarRelatorios,
  gerarRelatorio,
  excluirRelatorio,
  listarEmpresas
} from "../../shared/services/api";
import { cardPop, stagger } from "../../shared/animations/motionVariants";
import { useOperationalData } from "../hooks/useOperationalData";
import { useOperationalAction } from "../hooks/useOperationalAction";
import { OperationsFeedback, OperationsSearch } from "../components/OperationsFeedback";
import "../styles/Dashboard.css";
import "../styles/Pages.css";
const FETCHERS = [listarRelatorios, listarEmpresas];

export default function Reports({ setPage }) {
  const { data: [list, empresas], loading, error, updatedAt, refresh: load } = useOperationalData(FETCHERS);
  const { pending, act } = useOperationalAction();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    empresa_id: "", tipo: "mensal", periodo_ini: "", periodo_fim: "", titulo: ""
  });

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleGenerate(event) {
    event.preventDefault();
    if (!form.empresa_id) { toast.error("Selecione uma empresa"); return; }
    if (form.periodo_ini && form.periodo_fim && form.periodo_ini > form.periodo_fim) {
      toast.error("A data final deve ser igual ou posterior à data inicial"); return;
    }
    if (await act("create", () => gerarRelatorio(form), "Relatório gerado")) {
      setForm({ empresa_id: "", tipo: "mensal", periodo_ini: "", periodo_fim: "", titulo: "" });
      load();
    }
  }

  async function handleDelete(id, title) {
    if (!window.confirm(`Excluir o relatório "${title || `#${id}`}"? Esta ação não pode ser desfeita.`)) return;
    if (await act(`delete-${id}`, () => excluirRelatorio(id), "Relatório removido")) load();
  }

  function exportJson(rel) {
    const blob = new Blob([JSON.stringify(rel, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${rel.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.info(`Relatório #${rel.id} baixado`);
  }

  const filtered = list.filter((report) => [report.titulo, report.empresa_nome, report.tipo].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))));

  return (
    <main className="dashboard operations-page">
      <Sidebar active="reports" setPage={setPage} />

      <section className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <span className="tag">Inteligência operacional</span>
            <h1>Relatórios</h1>
            <p>Gere relatórios de leituras e consolide a operação por período.</p>
          </div>
        </div>

        <OperationsFeedback loading={loading} error={error} updatedAt={updatedAt} onRetry={load} />
        <div className="two-col">
          <form className="panel-box form-panel" onSubmit={handleGenerate}>
            <h2><FileText size={18} /> Gerar relatório</h2>
            <p className="form-note">Consolide as leituras de uma empresa. No período customizado, informe as duas datas.</p>

            <label htmlFor="report-company">Empresa *</label>
            <select id="report-company" required name="empresa_id" value={form.empresa_id} onChange={handleChange}>
              <option value="">Selecione...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>

            <label htmlFor="report-title">Título</label>
            <input id="report-title" name="titulo" value={form.titulo} onChange={handleChange}
                   placeholder="Ex: Inventário mensal" />

            <label htmlFor="report-type">Tipo</label>
            <select id="report-type" name="tipo" value={form.tipo} onChange={handleChange}>
              <option value="diario">Diário</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
              <option value="customizado">Customizado</option>
            </select>

            <div className="row-2">
              <div>
                <label htmlFor="report-start">Início{form.tipo === "customizado" ? " *" : ""}</label>
                <input id="report-start" type="date" required={form.tipo === "customizado"} max={form.periodo_fim || undefined} name="periodo_ini" value={form.periodo_ini} onChange={handleChange} />
              </div>
              <div>
                <label htmlFor="report-end">Fim{form.tipo === "customizado" ? " *" : ""}</label>
                <input id="report-end" type="date" required={form.tipo === "customizado"} min={form.periodo_ini || undefined} name="periodo_fim" value={form.periodo_fim} onChange={handleChange} />
              </div>
            </div>

            {!loading && !error && empresas.length === 0 && <p className="form-note">Cadastre uma empresa para gerar relatórios.</p>}
            <button className="btn-submit" type="submit" disabled={Boolean(pending) || empresas.length === 0}>
              {pending === "create" ? "Gerando..." : "Gerar relatório"}
            </button>
          </form>

          <div className="panel-box">
            <h2><FileText size={18} /> Histórico de relatórios</h2>
            <OperationsSearch value={search} onChange={setSearch} label="Buscar relatório" placeholder="Título, empresa ou tipo" />

            <motion.div className="report-list" variants={stagger} initial="hidden" animate="visible">
              {!loading && !error && filtered.length === 0 && <p className="empty-state">{search ? "Nenhum relatório corresponde à busca." : "Ainda não há relatórios. Selecione uma empresa para gerar o primeiro."}</p>}

              {filtered.map((r) => (
                <motion.div className="report-card" key={r.id} variants={cardPop}>
                  <div>
                    <strong>{r.titulo}</strong>
                    <p className="report-meta">
                      {r.empresa_nome} · {r.tipo} ·
                      {r.periodo_ini ? ` ${r.periodo_ini}` : ""} {r.periodo_fim ? `→ ${r.periodo_fim}` : ""}
                    </p>
                    <div className="report-nums">
                      <span><b>{r.total_lidos}</b> leituras</span>
                      <span className="warn"><b>{r.total_erros}</b> erros</span>
                    </div>
                  </div>

                  <div className="report-actions">
                    <button className="icon-btn" onClick={() => exportJson(r)} aria-label={`Exportar relatório ${r.titulo || r.id} em JSON`} title="Exportar JSON">
                      <Download size={14} />
                    </button>
                    <button className="icon-btn danger" disabled={Boolean(pending)} onClick={() => handleDelete(r.id, r.titulo)} aria-label={`Excluir relatório ${r.titulo || r.id}`} title="Excluir">
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
