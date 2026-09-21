import { useState } from "react";
import { motion } from "framer-motion";
import { Plane, Plus, Trash2, BatteryFull, BatteryMedium, BatteryLow } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { toast } from "../../shared/services/toast";
import { listarDrones, criarDrone, atualizarDrone, excluirDrone } from "../../shared/services/api";
import { cardPop, stagger } from "../../shared/animations/motionVariants";
import { useOperationalData } from "../hooks/useOperationalData";
import { useOperationalAction } from "../hooks/useOperationalAction";
import { OperationsFeedback, OperationsSearch } from "../components/OperationsFeedback";
import "../styles/Dashboard.css";
import "../styles/Pages.css";

const STATUS_OPTS = ["disponivel", "voando", "manutencao", "inativo"];
const STATUS_LABEL = { disponivel: "Disponível", voando: "Em voo", manutencao: "Em manutenção", inativo: "Inativo" };
const FETCHERS = [listarDrones];

function BatteryIcon({ pct }) {
  if (pct > 65) return <BatteryFull size={16} />;
  if (pct > 30) return <BatteryMedium size={16} />;
  return <BatteryLow size={16} />;
}

export default function Drones({ setPage }) {
  const { data: [list], loading, error, updatedAt, refresh: load } = useOperationalData(FETCHERS);
  const { pending, act } = useOperationalAction();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({ modelo: "", serial: "", bateria_pct: 100, status: "disponivel" });


  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!form.modelo.trim()) { toast.error("Informe o modelo"); return; }
    const battery = Number(form.bateria_pct);
    if (form.bateria_pct === "" || !Number.isFinite(battery) || battery < 0 || battery > 100) {
      toast.error("Informe uma bateria entre 0 e 100%"); return;
    }
    if (await act("create", () => criarDrone({ ...form, modelo: form.modelo.trim(), bateria_pct: battery }), `Drone "${form.modelo.trim()}" cadastrado`)) {
      setForm({ modelo: "", serial: "", bateria_pct: 100, status: "disponivel" });
      load();
    }
  }

  async function handleStatus(d, status) {
    if (await act(`status-${d.id}`, () => atualizarDrone(d.id, { ...d, status }), `${d.modelo}: ${STATUS_LABEL[status]}`)) load();
  }

  async function handleDelete(id, modelo) {
    if (!window.confirm(`Excluir o drone "${modelo}"? Esta ação não pode ser desfeita.`)) return;
    if (await act(`delete-${id}`, () => excluirDrone(id), "Drone removido")) load();
  }

  const filtered = list.filter((drone) => (!statusFilter || drone.status === statusFilter)
    && [drone.modelo, drone.serial].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))));

  return (
    <main className="dashboard operations-page">
      <Sidebar active="drones" setPage={setPage} />

      <section className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <span className="tag">Frota</span>
            <h1>Frota de drones</h1>
            <p>Gerencie a frota de drones, status operacional e nível de bateria.</p>
          </div>
        </div>

        <OperationsFeedback loading={loading} error={error} updatedAt={updatedAt} onRetry={load} />
        <div className="two-col">
          <form className="panel-box form-panel" onSubmit={handleCreate}>
            <h2><Plus size={18} /> Novo drone</h2>

            <label htmlFor="drone-model">Modelo *</label>
            <input id="drone-model" required name="modelo" value={form.modelo} onChange={handleChange}
                   placeholder="Ex: DJI Mavic 3" />

            <label htmlFor="drone-serial">Número de série</label>
            <input id="drone-serial" name="serial" value={form.serial} onChange={handleChange}
                   placeholder="SN-0001" />

            <label htmlFor="drone-battery">Bateria (%) *</label>
            <input id="drone-battery" required name="bateria_pct" type="number" min="0" max="100" step="1"
                   value={form.bateria_pct} onChange={handleChange} />

            <label htmlFor="drone-status">Status</label>
            <select id="drone-status" name="status" value={form.status} onChange={handleChange}>
              {STATUS_OPTS.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>

            <button className="btn-submit" type="submit" disabled={Boolean(pending)}>{pending === "create" ? "Salvando…" : "Cadastrar drone"}</button>
          </form>

          <div className="panel-box">
            <h2><Plane size={18} /> Frota</h2>
            <div className="operations-filter-row">
              <OperationsSearch value={search} onChange={setSearch} label="Buscar drone" placeholder="Modelo ou número de série" />
              <select aria-label="Filtrar drones por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Todos os status</option>
                {STATUS_OPTS.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
              </select>
            </div>

            <motion.div className="drone-grid" variants={stagger} initial="hidden" animate="visible">
              {!loading && !error && filtered.length === 0 && <p className="empty-state">{search || statusFilter ? "Nenhum drone corresponde aos filtros." : "Nenhum drone cadastrado. Adicione o primeiro à sua frota."}</p>}

              {filtered.map((d) => (
                <motion.div className={`drone-card status-${d.status}`} key={d.id} variants={cardPop}>
                  <div className="drone-head">
                    <Plane size={20} />
                    <strong>{d.modelo}</strong>
                    <button className="icon-btn danger" disabled={Boolean(pending)} onClick={() => handleDelete(d.id, d.modelo)} aria-label={`Excluir drone ${d.modelo}`} title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <p className="drone-serial">{d.serial || "Sem serial"}</p>

                  <div className="drone-bat">
                    <BatteryIcon pct={d.bateria_pct} />
                    <div className="bat-track">
                      <div className="bat-fill" style={{ width: `${Math.max(0, Math.min(100, Number(d.bateria_pct) || 0))}%` }} />
                    </div>
                    <span>{d.bateria_pct}%</span>
                  </div>

                  <select aria-label={`Status do drone ${d.modelo}`} disabled={Boolean(pending)} value={d.status} onChange={(e) => handleStatus(d, e.target.value)}>
                    {STATUS_OPTS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
}
