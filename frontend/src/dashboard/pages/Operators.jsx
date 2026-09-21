import { useState } from "react";
import { motion } from "framer-motion";
import { Users, UserPlus, Trash2, Building2, Layers, ShieldCheck } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { toast } from "../../shared/services/toast";
import {
  listarOperadores, criarOperador, excluirOperador,
  listarEmpresas, listarSetores, criarSetor, excluirSetor
} from "../../shared/services/api";
import { isAdmin } from "../../shared/utils/auth";
import { useOperationalData } from "../hooks/useOperationalData";
import { useOperationalAction } from "../hooks/useOperationalAction";
import { OperationsFeedback, OperationsSearch } from "../components/OperationsFeedback";
import { cardPop, stagger } from "../../shared/animations/motionVariants";
import "../styles/Dashboard.css";
import "../styles/Pages.css";

const PERMISSOES = [
  { key: "leitura",    label: "Leituras" },
  { key: "relatorios", label: "Relatórios" },
  { key: "operacoes",  label: "Operações" },
  { key: "alertas",    label: "Alertas" },
  { key: "drones",     label: "Drones" }
];

const EMPTY = {
  nome: "", email: "", senha: "", empresa_id: "", setor_id: "", permissoes: ["leitura"]
};
const FETCHERS = [listarOperadores, listarEmpresas, listarSetores];

export default function Operators({ setPage }) {
  const admin = isAdmin();

  const { data: [operadores, empresas, setores], loading, error, updatedAt, refresh: load } = useOperationalData(FETCHERS, { enabled: admin });
  const { pending, act } = useOperationalAction();
  const [search, setSearch] = useState("");
  const [form, setForm]             = useState(EMPTY);
  const [novoSetor, setNovoSetor]   = useState({ nome: "", empresa_id: "" });

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value, ...(e.target.name === "empresa_id" ? { setor_id: "" } : {}) }));
  }

  function togglePerm(key) {
    setForm((f) => ({
      ...f,
      permissoes: f.permissoes.includes(key)
        ? f.permissoes.filter((p) => p !== key)
        : [...f.permissoes, key]
    }));
  }

  async function handleCreateOperador(event) {
    event.preventDefault();
    if (!form.nome.trim())  { toast.error("Informe o nome do operador"); return; }
    if (!form.email.trim()) { toast.error("Informe o e-mail"); return; }
    if (!form.empresa_id)   { toast.error("Vincule o operador a uma empresa"); return; }

    if (await act("operator-create", () => criarOperador(form), `Operador "${form.nome}" cadastrado`)) {
      setForm(EMPTY);
      load();
    }
  }

  async function handleDeleteOperador(id, nome) {
    if (!window.confirm(`Excluir operador "${nome}"? Esta ação não pode ser desfeita.`)) return;
    if (await act(`operator-delete-${id}`, () => excluirOperador(id), "Operador removido")) load();
  }

  async function handleCreateSetor(event) {
    event.preventDefault();
    if (!novoSetor.nome.trim()) { toast.error("Informe o nome do setor"); return; }
    if (await act("sector-create", () => criarSetor(novoSetor), "Setor criado")) {
      setNovoSetor({ nome: "", empresa_id: "" });
      load();
    }
  }

  async function handleDeleteSetor(id) {
    if (!window.confirm("Excluir setor? Esta ação não pode ser desfeita.")) return;
    if (await act(`sector-delete-${id}`, () => excluirSetor(id), "Setor removido")) load();
  }

  const query = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = operadores.filter((o) => [o.nome, o.email, o.empresa_nome]
    .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(query)));

  /* Tela restrita ao administrador */
  if (!admin) {
    return (
      <main className="dashboard">
        <Sidebar active="operators" setPage={setPage} />
        <section className="dashboard-content">
          <div className="dashboard-header">
            <div>
              <span className="tag">Acesso restrito</span>
              <h1>Operadores</h1>
            </div>
          </div>
          <div className="panel-box">
            <p className="empty-state">
              Apenas o administrador (admin@gestock.com.br) pode cadastrar operadores.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard operations-page">
      <Sidebar active="operators" setPage={setPage} />

      <section className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <span className="tag">Controle de acesso</span>
            <h1>Operadores</h1>
            <p>Cadastre operadores e defina empresa, setor e permissões de acesso.</p>
          </div>
        </div>

        <OperationsFeedback loading={loading} error={error} updatedAt={updatedAt} onRetry={load} />
        <div className="two-col">
          {/* ── Formulário de operador ── */}
          <form className="panel-box form-panel" onSubmit={handleCreateOperador}>
            <h2><UserPlus size={18} /> Novo operador</h2>

            <label htmlFor="operator-name">Nome *</label>
            <input id="operator-name" required autoComplete="name" maxLength={160} name="nome" value={form.nome} onChange={handleChange}
                   placeholder="Nome completo" />

            <label htmlFor="operator-email">E-mail *</label>
            <input id="operator-email" required autoComplete="email" name="email" type="email" value={form.email} onChange={handleChange}
                   placeholder="operador@gestock.com.br" />

            <label htmlFor="operator-password">Senha inicial *</label>
            <input id="operator-password" name="senha" type="password" required minLength={8} autoComplete="new-password" value={form.senha} onChange={handleChange}
                   placeholder="No mínimo 8 caracteres" />

            <label htmlFor="operator-company">Empresa *</label>
            <select id="operator-company" required name="empresa_id" value={form.empresa_id} onChange={handleChange}>
              <option value="">Selecione...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>

            <label htmlFor="operator-sector">Setor (opcional)</label>
            <select id="operator-sector" disabled={!form.empresa_id} name="setor_id" value={form.setor_id} onChange={handleChange}>
              <option value="">— Sem setor —</option>
              {setores
                .filter((s) => !form.empresa_id || String(s.empresa_id) === String(form.empresa_id))
                .map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
            </select>

            <span className="form-note">Permissões</span>
            <div className="perm-grid" role="group" aria-label="Permissões do operador">
              {PERMISSOES.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  aria-pressed={form.permissoes.includes(p.key)}
                  className={`perm-chip${form.permissoes.includes(p.key) ? " on" : ""}`}
                  onClick={() => togglePerm(p.key)}
                >
                  <ShieldCheck size={13} /> {p.label}
                </button>
              ))}
            </div>

            <button className="btn-submit" type="submit" disabled={Boolean(pending) || !empresas.length}>
              {pending === "operator-create" ? "Salvando..." : "Cadastrar operador"}
            </button>
          </form>

          {/* ── Lista de operadores ── */}
          <div className="panel-box">
            <h2><Users size={18} /> Operadores cadastrados</h2>
            <OperationsSearch value={search} onChange={setSearch} label="Buscar operador" placeholder="Nome, e-mail ou empresa" />

            <motion.div className="op-list" variants={stagger} initial="hidden" animate="visible">
              {!loading && !error && filtered.length === 0 && (
                <p className="empty-state">{query ? "Nenhum operador corresponde à busca." : "Nenhum operador cadastrado."}</p>
              )}

              {filtered.map((o) => (
                <motion.div className="operator-card" key={o.id} variants={cardPop}>
                  <div className="operator-avatar">
                    {(o.nome || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="operator-info">
                    <strong>{o.nome}</strong>
                    <span className="operator-email">{o.email}</span>
                    <div className="operator-meta">
                      <span><Building2 size={12} /> {o.empresa_nome || "—"}</span>
                      <span><Layers size={12} /> {o.setor_nome || "Sem setor"}</span>
                    </div>
                    <div className="operator-perms">
                      {String(o.permissoes || "").split(",").filter(Boolean).map((p) => (
                        <span className="pill tag-cyan" key={p}>{p}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    className="icon-btn danger"
                    aria-label={`Excluir operador ${o.nome}`} disabled={Boolean(pending)}
                    onClick={() => handleDeleteOperador(o.id, o.nome)}
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* ── Setores ── */}
        <div className="panel-box">
          <div className="panel-header">
            <h2><Layers size={18} /> Setores</h2>
          </div>

          <form className="setor-add" onSubmit={handleCreateSetor}>
            <input
              aria-label="Nome do novo setor" required
              placeholder="Nome do setor (ex: Recebimento)"
              value={novoSetor.nome}
              onChange={(e) => setNovoSetor((s) => ({ ...s, nome: e.target.value }))}
            />
            <select
              aria-label="Empresa do novo setor" required
              value={novoSetor.empresa_id}
              onChange={(e) => setNovoSetor((s) => ({ ...s, empresa_id: e.target.value }))}
            >
              <option value="">Empresa...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
            <button type="submit" disabled={Boolean(pending) || !empresas.length}>{pending === "sector-create" ? "Salvando…" : "Adicionar setor"}</button>
          </form>

          <div className="setor-grid">
            {!loading && !error && setores.length === 0 && <p className="empty-state">Nenhum setor cadastrado.</p>}
            {setores.map((s) => (
              <div className="setor-chip" key={s.id}>
                <Layers size={14} />
                <div>
                  <strong>{s.nome}</strong>
                  <span>{s.empresa_nome || "Geral"}</span>
                </div>
                <button className="icon-btn danger" aria-label={`Excluir setor ${s.nome}`} disabled={Boolean(pending)} onClick={() => handleDeleteSetor(s.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
