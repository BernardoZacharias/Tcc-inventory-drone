import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, Eye, Building2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { toast } from "../../shared/services/toast";
import { listarEmpresas, criarEmpresa, excluirEmpresa } from "../../shared/services/api";
import { isAdmin } from "../../shared/utils/auth";
import { useOperationalData } from "../hooks/useOperationalData";
import { useOperationalAction } from "../hooks/useOperationalAction";
import { OperationsFeedback, OperationsSearch } from "../components/OperationsFeedback";
import { cardPop, stagger } from "../../shared/animations/motionVariants";
import "../styles/Dashboard.css";
import "../styles/Companies.css";
import "../styles/Pages.css";

const SEGMENTS = [
  "Operação logística",
  "Centro de distribuição",
  "Estoque técnico",
  "Varejo",
  "Indústria",
  "Outro"
];

function formatCnpj(v) {
  v = v.replace(/\D/g, "").slice(0, 14);
  return v
    .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/, "$1.$2.$3/$4")
    .replace(/^(\d{2})(\d{3})(\d{3})$/, "$1.$2.$3")
    .replace(/^(\d{2})(\d{3})$/, "$1.$2")
    .replace(/^(\d{2})$/, "$1");
}

const EMPTY = {
  nome: "", cnpj: "", segmento: "", responsavel: "", email: "", telefone: "", observacao: ""
};
const FETCHERS = [listarEmpresas];

export default function Companies({ setPage, goToCompany }) {
  const admin = isAdmin();
  const { data: [companies], loading: fetching, error, updatedAt, refresh: load } = useOperationalData(FETCHERS);
  const { pending, act } = useOperationalAction();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === "cnpj" ? formatCnpj(value) : value }));
  }

  async function handleAdd(event) {
    event.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Informe a razão social");
      return;
    }
    if (form.cnpj && form.cnpj.replace(/\D/g, "").length !== 14) {
      toast.error("Informe os 14 dígitos do CNPJ ou deixe o campo vazio");
      return;
    }
    if (await act("create", () => criarEmpresa({ ...form, nome: form.nome.trim(), email: form.email.trim() }), `Empresa "${form.nome.trim()}" cadastrada`)) {
      setForm(EMPTY);
      load();
    }
  }

  async function handleDelete(id, nome) {
    if (!window.confirm(`Excluir a empresa "${nome}"? Esta ação não pode ser desfeita.`)) return;
    if (await act(`delete-${id}`, () => excluirEmpresa(id), "Empresa removida")) {
      load();
    }
  }

  const query = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = query
    ? companies.filter(
        (c) =>
          [c.nome, c.segmento, c.cnpj, c.responsavel].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(query))
      )
    : companies;

  return (
    <main className="dashboard operations-page">
      <Sidebar active="companies" setPage={setPage} />

      <section className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <span className="tag">Gerenciamento</span>
            <h1>
              Empresas <span className="count-badge">{updatedAt ? `${companies.length} cadastradas` : "—"}</span>
            </h1>
            <p>Cadastre e gerencie as empresas vinculadas ao sistema de leitura por drone.</p>
          </div>
        </div>

        <OperationsFeedback loading={fetching} error={error} updatedAt={updatedAt} onRetry={load} />
        <div className={`companies-layout${admin ? "" : " single"}`}>
          {/* ── FORMULÁRIO (somente admin) ── */}
          {admin && (
          <form className="companies-form panel-box" onSubmit={handleAdd}>
            <h2><Building2 size={18} /> Nova empresa</h2>
            <p className="form-note">Campos com * são obrigatórios.</p>

            <label htmlFor="company-name">Razão social *</label>
            <input id="company-name" name="nome" required autoComplete="organization" value={form.nome} onChange={handleChange} placeholder="Ex: Gestock Logística Ltda" />

            <label htmlFor="company-cnpj">CNPJ</label>
            <input id="company-cnpj" name="cnpj" inputMode="numeric" value={form.cnpj} onChange={handleChange} placeholder="00.000.000/0000-00" />

            <label htmlFor="company-segment">Segmento</label>
            <select id="company-segment" name="segmento" value={form.segmento} onChange={handleChange}>
              <option value="">Selecione...</option>
              {SEGMENTS.map((s) => <option key={s}>{s}</option>)}
            </select>

            <label htmlFor="company-contact">Responsável</label>
            <input id="company-contact" name="responsavel" autoComplete="name" value={form.responsavel} onChange={handleChange} placeholder="Nome do contato" />

            <label htmlFor="company-email">E-mail</label>
            <input id="company-email" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} placeholder="contato@empresa.com" />

            <label htmlFor="company-phone">Telefone</label>
            <input id="company-phone" name="telefone" type="tel" autoComplete="tel" value={form.telefone} onChange={handleChange} placeholder="(00) 00000-0000" />

            <label htmlFor="company-notes">Observação</label>
            <textarea id="company-notes" name="observacao" value={form.observacao} onChange={handleChange} placeholder="Informações adicionais..." />

            <button className="btn-submit" type="submit" disabled={Boolean(pending)}>
              {pending === "create" ? "Salvando..." : "Cadastrar empresa"}
            </button>
          </form>
          )}

          {/* ── LISTAGEM ── */}
          <div className="companies-list panel-box">
            <h2>Empresas cadastradas</h2>
            <OperationsSearch value={search} onChange={setSearch} label="Buscar empresa" placeholder="Nome, CNPJ, segmento ou responsável" />
            <div className="companies-table-wrap" role="region" aria-label="Empresas cadastradas" tabIndex={0}>
            <table className="companies-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Segmento</th>
                  <th>Leituras</th>
                  <th><span className="operations-sr-only">Ações</span></th>
                </tr>
              </thead>
              <motion.tbody variants={stagger} initial="hidden" animate="visible">
                {filtered.map((c) => (
                  <motion.tr key={c.id} variants={cardPop}>
                    <td>
                      <span className="company-name">{c.nome}</span>
                      <br />
                      <span className="company-cnpj">{c.cnpj || "—"}</span>
                    </td>
                    <td className="seg-cell">{c.segmento || "—"}</td>
                    <td className="readings-cell">{c.total_leituras ?? 0}</td>
                    <td className="actions-cell">
                      <button className="icon-btn" onClick={() =>
                        goToCompany({
                          id: c.id, name: c.nome, segment: c.segmento, readings: c.total_leituras
                        })}
                        aria-label={`Ver empresa ${c.nome}`} title="Ver empresa">
                        <Eye size={14} />
                      </button>
                      {admin && (
                        <button className="icon-btn danger" disabled={Boolean(pending)} onClick={() => handleDelete(c.id, c.nome)} aria-label={`Excluir empresa ${c.nome}`} title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
                {!fetching && !error && filtered.length === 0 && (
                  <tr><td colSpan={4} className="empty-row">{query ? "Nenhuma empresa corresponde à busca. Tente outro nome ou CNPJ." : "Nenhuma empresa cadastrada ainda."}</td></tr>
                )}
              </motion.tbody>
            </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
