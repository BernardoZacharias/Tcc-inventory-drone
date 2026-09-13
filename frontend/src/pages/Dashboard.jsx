import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, QrCode, Radar, Plane, Bell, Users,
  TrendingUp, Activity, Plus, RefreshCw, Boxes, Package,
  MapPin, AlertTriangle, ScanLine, Volume2, VolumeX
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import MetricCard from "../components/MetricCard";
import CompanyCard from "../components/CompanyCard";
import BackendBadge from "../components/BackendBadge";
import { toast } from "../services/toast";
import {
  resumoStats, listarEmpresas, criarEmpresa, listarLeituras
} from "../services/api";
import { beepLeituraNova } from "../utils/beep";
import { isAdmin, getCurrentUser } from "../utils/auth";
import { cardPop, stagger, fadeUp } from "../animations/motionVariants";
import "../styles/Dashboard.css";
import "../styles/Pages.css";
import "../styles/DashboardUX.css";

const EMPTY_SERIES = [];
const SOURCES = ["métricas", "empresas", "leituras"];
const number = (value) => value == null ? "—" : Number(value).toLocaleString("pt-BR");

export default function Dashboard({ setPage, goToCompany }) {
  const admin = isAdmin();
  const user = getCurrentUser();

  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyName, setCompanyName] = useState("");
  const [recent, setRecent] = useState([]);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState([]);
  const [loaded, setLoaded] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef(false);
  const lastIdRef = useRef(0);
  const requestRef = useRef(null);
  const mountedRef = useRef(false);

  const loadAll = useCallback(async (initial = false, manual = false) => {
    if (requestRef.current) return;
    const requestId = Symbol("dashboard-request");
    requestRef.current = requestId;
    const results = await Promise.allSettled([
      resumoStats(), listarEmpresas(), listarLeituras()
    ]);
    if (!mountedRef.current || requestRef.current !== requestId) return;
    const responses = results.map((result) => result.status === "fulfilled" ? result.value : null);
    const [s, e, l] = responses;
    const errors = SOURCES.filter((_, index) => !responses[index]?.success);
    if (s?.success) setStats(s.data);
    if (e?.success) setCompanies(e.data || []);

    if (l?.success) {
      const items = (l.data || []).slice(0, 8);
      const newestId = items[0]?.id || 0;
      if (!initial && lastIdRef.current && newestId > lastIdRef.current) {
        if (soundRef.current) beepLeituraNova();
      }
      lastIdRef.current = newestId;
      setRecent(items);
    }
    setLoaded((previous) => ({ ...previous, ...Object.fromEntries(SOURCES.filter((_, index) => responses[index]?.success).map((source) => [source, true])) }));
    setLoadErrors(errors);
    setLoading(false);
    setRefreshing(false);
    if (!errors.length) setLastUpdated(new Date());
    if (manual) {
      if (errors.length) toast.error("Alguns dados não puderam ser atualizados. Os últimos dados disponíveis foram mantidos.");
      else toast.success("Dados atualizados");
    }
    requestRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initialTimer = setTimeout(() => loadAll(true), 0);
    const id = setInterval(() => { if (!document.hidden) loadAll(false); }, 6000);
    return () => { mountedRef.current = false; requestRef.current = null; clearTimeout(initialTimer); clearInterval(id); };
  }, [loadAll]);

  async function addCompany() {
    if (saving) return;
    const name = companyName.trim();
    if (!name) { toast.error("Digite um nome de empresa"); return; }
    setSaving(true);
    const r = await criarEmpresa({ nome: name, segmento: "Nova operação" });
    setSaving(false);
    if (r?.success) {
      setCompanyName("");
      toast.success(`Empresa "${name}" cadastrada`);
      loadAll(true);
    } else {
      toast.error(r?.message || "Erro ao cadastrar");
    }
  }

  const serie = stats?.serie_7d || EMPTY_SERIES;
  const emptyReadings = loading ? "Carregando leituras…" : !loaded.leituras ? "Leituras indisponíveis. Tente atualizar." : "Nenhuma leitura registrada neste período.";
  const emptyMetrics = loading ? "Carregando métricas…" : !stats ? "Métricas indisponíveis. Tente atualizar." : "Nenhuma leitura registrada neste período.";
  const maxSerie = useMemo(() => Math.max(1, ...serie.map((x) => x.total)), [serie]);
  const maxSetor = useMemo(
    () => Math.max(1, ...(stats?.por_setor || []).map((x) => x.leituras)),
    [stats]
  );
  const maxOperador = useMemo(
    () => Math.max(1, ...(stats?.por_operador || []).map((x) => x.leituras)),
    [stats]
  );

  return (
    <main className="dashboard dashboard-overview">
      <Sidebar active="dashboard" setPage={setPage} />

      <section className="dashboard-content">
        <motion.div className="dashboard-header" variants={fadeUp} initial="hidden" animate="visible">
          <div>
            <span className="tag">Painel operacional</span>
            <h1>Visão geral</h1>
            <p>
              {admin
                ? "Acompanhe leituras, operações, alertas e a saúde da frota."
                : `Acompanhe as leituras e operações da sua empresa, ${user?.nome || "operador"}.`}
            </p>
          </div>
          <div className="header-tools">
            <BackendBadge />
            <button
              className={`refresh-btn${refreshing ? " spinning" : ""}`}
              onClick={() => { if (!requestRef.current) { setRefreshing(true); loadAll(true, true); } }}
              title="Atualizar"
              disabled={refreshing || loading}
              aria-busy={refreshing}
            >
              <RefreshCw size={14} />
              <span>{refreshing ? "Atualizando…" : "Atualizar"}</span>
            </button>
            <button className="refresh-btn" aria-pressed={soundOn}
              aria-label={soundOn ? "Silenciar novas leituras" : "Ativar som para novas leituras"}
              onClick={() => { soundRef.current = !soundOn; setSoundOn(!soundOn); }}>
              {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span>{soundOn ? "Som ligado" : "Sem som"}</span>
            </button>
            <div className="header-pulse">
              <Activity size={14} />
              <span>auto a cada 6s</span>
            </div>
          </div>
        </motion.div>

        <div className={`overview-sync${loadErrors.length ? " has-error" : ""}`} role="status" aria-live="polite">
          {loadErrors.length ? <AlertTriangle size={17} aria-hidden="true" /> : <Activity size={17} aria-hidden="true" />}
          <div>
            <strong>{loading ? "Conectando aos dados da operação…" : loadErrors.length ? "Atualização incompleta" : "Dados sincronizados"}</strong>
            <p>{loadErrors.length
              ? `Não foi possível atualizar ${loadErrors.join(", ")}. Valores anteriores foram mantidos; “—” indica dado indisponível.`
              : loading ? "As métricas aparecem assim que o servidor responder." : `Última sincronização às ${lastUpdated?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}. Atualização automática enquanto esta aba estiver visível.`}</p>
          </div>
          {loadErrors.length > 0 && <button className="link-btn" disabled={refreshing} onClick={() => { if (!requestRef.current) { setRefreshing(true); loadAll(true, true); } }}>Tentar novamente</button>}
        </div>

        {/* ── Métricas principais ── */}
        <motion.div className="metrics-grid" variants={stagger} initial="hidden" animate="visible">
          <motion.div variants={cardPop}>
            <MetricCard title="Empresas" value={number(stats?.empresas)}
              icon={Building2} accent="cyan" onClick={() => setPage("companies")} />
          </motion.div>
          <motion.div variants={cardPop}>
            <MetricCard title="Leituras totais" value={number(stats?.leituras)}
              icon={QrCode} accent="green" hint={stats ? `${number(stats.leituras_hoje)} hoje` : "Aguardando dados"}
              onClick={() => setPage("readings")} />
          </motion.div>
          <motion.div variants={cardPop}>
            <MetricCard title="Operações" value={number(stats?.operacoes)}
              icon={Radar} accent="violet" onClick={() => setPage("operations")} />
          </motion.div>
          <motion.div variants={cardPop}>
            <MetricCard title="Operadores" value={number(stats?.operadores)}
              icon={Users} accent="amber"
              onClick={admin ? () => setPage("operators") : undefined} />
          </motion.div>
          <motion.div variants={cardPop}>
            <MetricCard title="Drones disponíveis" value={number(stats?.drones_disponiveis)}
              icon={Plane} accent="cyan" onClick={() => setPage("drones")} />
          </motion.div>
          <motion.div variants={cardPop}>
            <MetricCard title="Alertas ativos" value={number(stats?.alertas)}
              icon={Bell} accent="red" onClick={() => setPage("alerts")} />
          </motion.div>
        </motion.div>

        {/* ── Métricas estruturadas das leituras ── */}
        <motion.div className="substats-grid" variants={stagger} initial="hidden" animate="visible">
          <motion.div className="substat" variants={cardPop}>
            <Boxes size={18} />
            <div><strong>{number(stats?.quantidade_total)}</strong><span>Quantidade total de itens</span></div>
          </motion.div>
          <motion.div className="substat" variants={cardPop}>
            <Package size={18} />
            <div><strong>{number(stats?.produtos_distintos)}</strong><span>Produtos distintos</span></div>
          </motion.div>
          <motion.div className="substat" variants={cardPop}>
            <MapPin size={18} />
            <div><strong>{number(stats?.locais_distintos)}</strong><span>Locais lidos</span></div>
          </motion.div>
          <motion.div className="substat warn" variants={cardPop}>
            <AlertTriangle size={18} />
            <div><strong>{number(stats?.itens_frageis)}</strong><span>Itens frágeis</span></div>
          </motion.div>
        </motion.div>

        {/* ── Gráfico 7 dias + Top empresas ── */}
        <div className="dashboard-row">
          <motion.div className="dashboard-panel chart-panel" variants={fadeUp} initial="hidden" animate="visible">
            <div className="panel-header">
              <div>
                <h2>Leituras nos últimos 7 dias</h2>
                <p className="muted">Distribuição diária dos QR captados</p>
              </div>
              <TrendingUp size={20} className="muted" />
            </div>
            <div className="bar-chart">
              {serie.length === 0 && <p className="empty-state">{emptyMetrics}</p>}
              {serie.map((b) => {
                const h = (b.total / maxSerie) * 100;
                return (
                  <div className="bar-col" key={b.dia} aria-label={`${new Date(`${b.dia}T12:00:00`).toLocaleDateString("pt-BR")}: ${b.total} leituras`}>
                    <div className="bar-value">{number(b.total)}</div>
                    <div className="overview-bar-track"><motion.div className="bar" initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} /></div>
                    <div className="bar-label">
                      {new Date(`${b.dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div className="dashboard-panel" variants={fadeUp} initial="hidden" animate="visible">
            <div className="panel-header"><h2>Leituras por empresa</h2></div>
            <div className="rank-list">
              {(stats?.top_empresas || []).map((e, i) => (
                <div key={i} className="rank-row">
                  <span className="rank-pos">#{i + 1}</span>
                  <span className="rank-name">{e.nome}</span>
                  <span className="rank-val">{e.leituras}</span>
                </div>
              ))}
              {(stats?.top_empresas || []).length === 0 && <p className="empty-state">{emptyMetrics}</p>}
            </div>
          </motion.div>
        </div>

        {/* ── Por setor + Por operador ── */}
        <div className="dashboard-row">
          <motion.div className="dashboard-panel" variants={fadeUp} initial="hidden" animate="visible">
            <div className="panel-header"><h2>Leituras por setor</h2></div>
            <div className="track-list">
              {(stats?.por_setor || []).map((s, i) => (
                <div className="track-row" key={i}>
                  <span className="track-name">{s.nome}</span>
                  <div className="track-bar">
                    <motion.div className="track-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.leituras / maxSetor) * 100}%` }}
                      transition={{ duration: 0.8 }} />
                  </div>
                  <span className="track-val">{s.leituras}</span>
                </div>
              ))}
              {(stats?.por_setor || []).length === 0 && <p className="empty-state">{emptyMetrics}</p>}
            </div>
          </motion.div>

          <motion.div className="dashboard-panel" variants={fadeUp} initial="hidden" animate="visible">
            <div className="panel-header"><h2>Leituras por operador</h2></div>
            <div className="track-list">
              {(stats?.por_operador || []).map((o, i) => (
                <div className="track-row" key={i}>
                  <span className="track-name">{o.nome}</span>
                  <div className="track-bar">
                    <motion.div className="track-fill violet"
                      initial={{ width: 0 }}
                      animate={{ width: `${(o.leituras / maxOperador) * 100}%` }}
                      transition={{ duration: 0.8 }} />
                  </div>
                  <span className="track-val">{o.leituras}</span>
                </div>
              ))}
              {(stats?.por_operador || []).length === 0 && <p className="empty-state">{emptyMetrics}</p>}
            </div>
          </motion.div>
        </div>

        {/* ── Últimas leituras (estruturadas) ── */}
        <motion.div className="dashboard-panel" variants={fadeUp} initial="hidden" animate="visible">
          <div className="panel-header">
            <h2>Últimas leituras</h2>
            <div className="panel-header-actions">
              <button className="btn-new-reading sm" onClick={() => setPage("reading")}>
                <ScanLine size={15} /> Nova leitura
              </button>
              <button className="link-btn" onClick={() => setPage("readings")}>Ver todas →</button>
            </div>
          </div>
          <div className="readings-grid">
            {recent.length === 0 && <p className="empty-state">{emptyReadings}</p>}
            {recent.map((r) => (
              <motion.div className="reading-struct-card" key={r.id}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
                  <span>Local: <b>{r.local_lido || "—"}</b></span>
                  <span>Setor: <b>{r.setor || "—"}</b></span>
                </div>
                <div className="rs-foot">
                  <span className="pill tag-cyan">{r.status}</span>
                  <small>{new Date(r.data_hora_leitura || r.criado_em).toLocaleTimeString()}</small>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Empresas cadastradas ── */}
        <motion.div className="dashboard-panel" variants={fadeUp} initial="hidden" animate="visible">
          <div className="panel-header">
            <h2>Empresas cadastradas</h2>
            {admin && (
              <form className="add-company" onSubmit={(event) => { event.preventDefault(); addCompany(); }}>
                <input
                  aria-label="Nome da nova empresa"
                  name="companyName"
                  maxLength={160}
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Nova empresa"
                  disabled={saving}
                />
                <button type="submit" disabled={saving || !companyName.trim()}>
                  <Plus size={16} />
                  {saving ? "Salvando..." : "Adicionar"}
                </button>
              </form>
            )}
          </div>

          <motion.div className="company-grid" variants={stagger} initial="hidden" animate="visible">
            {companies.map((c) => (
              <motion.div key={c.id} variants={cardPop}>
                <CompanyCard
                  company={{
                    id: c.id,
                    name: c.nome,
                    segment: c.segmento || "—",
                    readings: c.total_leituras ?? 0
                  }}
                  onClick={() =>
                    goToCompany({ id: c.id, name: c.nome, segment: c.segmento, readings: c.total_leituras })
                  }
                />
              </motion.div>
            ))}
            {companies.length === 0 && <p className="empty-state">{loading ? "Carregando empresas…" : !loaded.empresas ? "Empresas indisponíveis. Tente atualizar." : "Nenhuma empresa cadastrada."}</p>}
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}
