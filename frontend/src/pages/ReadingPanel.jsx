import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, PauseCircle, PlayCircle, RadioTower,
  Volume2, VolumeX, QrCode, ScanLine, Package, AlertTriangle,
  Plus, X, MapPin, User, Boxes, Clock, Check, ChevronDown
} from "lucide-react";
import {
  iniciarLeitura, pararLeitura, statusLeitura,
  leiturasPorEmpresa, criarLeitura,
  listarEmpresas, listarOperadores, listarSetores,
  backendStatus
} from "../services/api";
import { parseQrCode, QR_EXEMPLO } from "../utils/qrParser";
import { beepLeituraNova } from "../utils/beep";
import { toast } from "../services/toast";
import { isAdmin, currentEmpresaId, getCurrentUser } from "../utils/auth";
import ScannerEffect from "../components/ScannerEffect";
import "../styles/ReadingPanel.css";
import "../styles/Pages.css";

/* Tempo relativo curto — "agora", "há 12s", "há 4min" */
function tempoRelativo(iso) {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 8) return "agora";
  if (s < 60) return `há ${Math.floor(s)}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)}min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

const DESTAQUE_MS = 8000; // por quanto tempo uma leitura fica marcada como nova

function CompanyCombobox({ companies, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const options = useMemo(
    () => [{ id: "", nome: "Selecione a empresa..." }, ...companies],
    [companies]
  );
  const selectedIndex = Math.max(
    0,
    options.findIndex((company) => String(company.id) === String(value))
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;

    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function openMenu() {
    if (disabled) return;
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function choose(index) {
    onChange(String(options[index].id));
    setActiveIndex(index);
    setOpen(false);
  }

  function handleKeyDown(event) {
    if (disabled) return;

    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }

      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (
        (current + direction + options.length) % options.length
      ));
      return;
    }

    if (open && event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (open && event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }

    if (open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      choose(activeIndex);
    }
  }

  return (
    <div className="cockpit-company-picker" ref={rootRef}>
      <button
        type="button"
        className="cockpit-empresa"
        role="combobox"
        aria-label="Empresa da leitura"
        aria-expanded={open}
        aria-controls="cockpit-company-options"
        aria-activedescendant={open ? `cockpit-company-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span className={!selected.id ? "is-placeholder" : undefined}>
          {selected.nome}
        </span>
        <ChevronDown className="cockpit-company-chevron" size={15} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="cockpit-company-options"
            className="cockpit-company-menu"
            role="listbox"
            aria-label="Empresas disponíveis"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            {options.map((company, index) => {
              const isSelected = index === selectedIndex;
              const isActive = index === activeIndex;

              return (
                <button
                  id={`cockpit-company-option-${index}`}
                  key={company.id || "empty"}
                  type="button"
                  className={`cockpit-company-option${isActive ? " is-active" : ""}`}
                  role="option"
                  aria-selected={isSelected}
                  onPointerEnter={() => setActiveIndex(index)}
                  onClick={() => choose(index)}
                >
                  <span>{company.nome}</span>
                  {isSelected && <Check size={14} strokeWidth={2.2} aria-hidden="true" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ReadingPanel({ setPage, company }) {
  const admin = isAdmin();
  const user = getCurrentUser();

  const [empresas, setEmpresas] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [setores, setSetores] = useState([]);

  const [empresaId, setEmpresaId] = useState(company?.id || currentEmpresaId() || "");
  const [operadorId, setOperadorId] = useState("");
  const [setorId, setSetorId] = useState("");

  const [status, setStatus] = useState("Aguardando início");
  const [active, setActive] = useState(false);
  const [readings, setReadings] = useState([]);
  const [soundOn, setSoundOn] = useState(true);
  const [qrText, setQrText] = useState("");
  const [saving, setSaving] = useState(false);
  // Qual empresa ja teve as leituras carregadas. Derivar o "carregando"
  // daqui evita setState sincrono dentro do useEffect (cascata de renders).
  const [carregadoPara, setCarregadoPara] = useState(null);

  // Painel de registro manual — fechado por padrao para nao roubar a dobra
  const [manualAberto, setManualAberto] = useState(false);
  // Ids que acabaram de chegar (ganham destaque temporario)
  const [novos, setNovos] = useState(() => new Set());
  // Forca o recalculo dos tempos relativos
  const [, setTick] = useState(0);

  const lastIdRef = useRef(0);
  const soundRef = useRef(true);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

  // Relogio dos "há 12s"
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      const [e, o, s] = await Promise.all([
        listarEmpresas(), listarOperadores(), listarSetores()
      ]);
      if (e?.success) {
        setEmpresas(e.data || []);
        // funcional: nao depende do valor atual, entao o effect roda so uma vez
        if (e.data?.length) setEmpresaId((atual) => atual || e.data[0].id);
      }
      if (o?.success) setOperadores(o.data || []);
      if (s?.success) setSetores(s.data || []);
    })();
  }, []);

  const marcarNovos = useCallback((ids) => {
    if (!ids.length) return;
    setNovos((atual) => {
      const p = new Set(atual);
      ids.forEach((i) => p.add(i));
      return p;
    });
    setTimeout(() => {
      setNovos((atual) => {
        const p = new Set(atual);
        ids.forEach((i) => p.delete(i));
        return p;
      });
    }, DESTAQUE_MS);
  }, []);

  const loadReadings = useCallback(async (inicial = false) => {
    if (!empresaId) return;
    const data = await leiturasPorEmpresa(empresaId);
    if (data?.success) {
      const items = data.data || [];
      const newestId = items[0]?.id || 0;

      if (!inicial && lastIdRef.current && newestId > lastIdRef.current) {
        const chegaram = items
          .filter((r) => r.id > lastIdRef.current)
          .map((r) => r.id);
        marcarNovos(chegaram);
        if (soundRef.current) beepLeituraNova();
      }
      lastIdRef.current = newestId;
      setReadings(items);
    }
    setCarregadoPara(empresaId);
  }, [empresaId, marcarNovos]);

  async function syncStatus() {
    const r = await statusLeitura();
    if (r?.sucesso) setActive(!!r.ativa);
  }

  useEffect(() => {
    lastIdRef.current = 0;
    let primeiro = true;

    // Tudo acontece depois de um await: nada de setState sincrono aqui.
    const tick = async () => {
      await loadReadings(primeiro);
      primeiro = false;
      await syncStatus();
    };

    tick();
    const id = setInterval(tick, 2500);
    return () => clearInterval(id);
  }, [empresaId, loadReadings]);

  async function startReading() {
    if (!empresaId) { toast.error("Selecione uma empresa"); return; }
    setStatus("Iniciando leitura...");
    const data = await iniciarLeitura(empresaId);
    const online = backendStatus() === true;

    if (online && data.sucesso) {
      setStatus("Scanner ativo — janela aberta no PC");
      setActive(true);
      toast.success("Scanner do drone iniciado");
    } else {
      setActive(false);
      setStatus("Backend offline — use o registro manual");
      toast.error("A leitura por tela precisa do backend (api-node) em execução.");
      setManualAberto(true);
    }
  }

  async function stopReading() {
    const online = backendStatus() === true;
    await pararLeitura();
    setStatus(online ? "Scanner encerrado" : "Aguardando início");
    setActive(false);
    toast.info("Scanner encerrado");
  }

  const preview = useMemo(() => parseQrCode(qrText), [qrText]);

  async function registrarLeitura() {
    if (!empresaId) { toast.error("Selecione uma empresa"); return; }
    if (!qrText.trim()) { toast.error("Cole o conteúdo do QR Code"); return; }

    setSaving(true);
    const r = await criarLeitura({
      empresa_id: empresaId,
      operador_id: operadorId || user?.id || null,
      setor_id: setorId || null,
      codigo_qr: qrText.trim(),
      origem: "MANUAL",
      status: "lido"
    });
    setSaving(false);

    if (r?.success) {
      if (soundRef.current) beepLeituraNova();
      toast.success("Leitura registrada");
      setQrText("");
      setManualAberto(false);
      if (r.data?.id) marcarNovos([r.data.id]);
      loadReadings(false);
    } else {
      toast.error(r?.message || "Erro ao registrar leitura");
    }
  }

  /* ── Métricas da sessão ── */
  const carregando = Boolean(empresaId) && carregadoPara !== empresaId;
  // Sem empresa escolhida nao ha o que listar (nem sobra do anterior)
  const lista = useMemo(() => (empresaId ? readings : []), [empresaId, readings]);
  const destaque = lista[0] || null;
  const stats = useMemo(() => {
    const itens = lista.reduce((s, r) => s + (Number(r.quantidade) || 0), 0);
    const frageis = lista.filter((r) => r.fragil === "Sim").length;
    const locais = new Set(lista.map((r) => r.local_lido).filter(Boolean)).size;
    return { itens, frageis, locais };
  }, [lista]);

  return (
    <main className="cockpit" id="conteudo">
      {/* ── Barra de comando ── */}
      <header className="cockpit-bar">
        <button className="cockpit-back" onClick={() => setPage("readings")}>
          <ArrowLeft size={16} strokeWidth={1.75} />
          <span>Leituras</span>
        </button>

        <div className="cockpit-id">
          <h1>Scanner do drone</h1>
          <CompanyCombobox
            companies={empresas}
            value={empresaId}
            onChange={setEmpresaId}
            disabled={!admin}
          />
        </div>

        <div className={`cockpit-status${active ? " live" : ""}`}>
          <RadioTower size={15} strokeWidth={1.75} />
          <span>{status}</span>
          {active && <i className="live-pulse" />}
        </div>

        <div className="cockpit-controls">
          <button
            className="cd-btn"
            onClick={() => setSoundOn((v) => !v)}
            title={soundOn ? "Silenciar bipe" : "Ativar bipe"}
            aria-pressed={soundOn}
          >
            {soundOn ? <Volume2 size={16} strokeWidth={1.75} /> : <VolumeX size={16} strokeWidth={1.75} />}
          </button>

          {active ? (
            <button className="cd-btn stop" onClick={stopReading}>
              <PauseCircle size={16} strokeWidth={1.75} /> Parar
            </button>
          ) : (
            <button className="cd-btn go" onClick={startReading}>
              <PlayCircle size={16} strokeWidth={1.75} /> Iniciar leitura
            </button>
          )}

          <button className="cd-btn" onClick={() => setManualAberto(true)}>
            <Plus size={16} strokeWidth={1.75} /> Manual
          </button>
        </div>
      </header>

      {/* ── Cockpit: visor + captura em destaque | feed ao vivo ── */}
      <div className="cockpit-grid">
        <section className="cockpit-stage">
          <div className="stage-viewport">
            <ScannerEffect />
          </div>

          {/* A ÚLTIMA LEITURA É O HERÓI DA TELA */}
          <div className="stage-latest">
            {destaque ? (
                <motion.article
                  key={destaque.id}
                  className={`latest-card${novos.has(destaque.id) ? " is-fresh" : ""}`}
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                >
                  <div className="latest-top">
                    <span className="latest-label">
                      {novos.has(destaque.id) ? "Capturado agora" : "Última captura"}
                    </span>
                    <span className="latest-time">
                      <Clock size={12} strokeWidth={1.75} />
                      {tempoRelativo(destaque.data_hora_leitura || destaque.criado_em)}
                    </span>
                  </div>

                  <h2 className="latest-name">
                    {destaque.nome_produto || destaque.codigo_qr || "Leitura sem nome"}
                  </h2>

                  <div className="latest-meta">
                    <span><Boxes size={13} strokeWidth={1.75} /> {destaque.quantidade ?? "—"} un.</span>
                    <span><MapPin size={13} strokeWidth={1.75} /> {destaque.local_lido || "sem local"}</span>
                    <span><User size={13} strokeWidth={1.75} /> {destaque.operador || "não identificado"}</span>
                    <span className="latest-sku">#{destaque.produto_id || "—"}</span>
                  </div>

                  {destaque.fragil === "Sim" && (
                    <span className="latest-fragil">
                      <AlertTriangle size={12} strokeWidth={1.75} /> Item frágil
                    </span>
                  )}
                </motion.article>
              ) : (
                <div className="latest-empty">
                  <ScanLine size={22} strokeWidth={1.25} />
                  <div>
                    <strong>Nenhuma captura ainda</strong>
                    <p>
                      Inicie o scanner do drone ou registre uma leitura manual —
                      ela aparece aqui na hora.
                    </p>
                  </div>
                </div>
              )}
          </div>
        </section>

        {/* ── Feed ao vivo: sempre visível, nunca abaixo da dobra ── */}
        <aside className="cockpit-feed" aria-label="Leituras capturadas">
          <div className="feed-head">
            <h2><QrCode size={15} strokeWidth={1.75} /> Feed ao vivo</h2>
            <span className={`feed-live${active ? " on" : ""}`}>
              <i /> {active ? "ao vivo" : "parado"}
            </span>
          </div>

          <div className="feed-stats">
            <div><strong>{lista.length}</strong><span>leituras</span></div>
            <div><strong>{stats.itens}</strong><span>itens</span></div>
            <div><strong>{stats.locais}</strong><span>locais</span></div>
            <div className={stats.frageis ? "warn" : ""}>
              <strong>{stats.frageis}</strong><span>frágeis</span>
            </div>
          </div>

          <ol className="feed-list">
            {carregando &&
              [0, 1, 2, 3].map((i) => (
                <li key={i} className="feed-skeleton">
                  <span className="skeleton" style={{ height: 13, width: "62%" }} />
                  <span className="skeleton" style={{ height: 10, width: "40%" }} />
                </li>
              ))}

            {!carregando && lista.length === 0 && (
              <li className="feed-empty">
                Nenhuma leitura para esta empresa ainda.
              </li>
            )}

            {!carregando &&
              lista.map((r, i) => (
                <motion.li
                  key={r.id}
                  className={`feed-item${novos.has(r.id) ? " is-fresh" : ""}${i === 0 ? " is-top" : ""}`}
                  initial={novos.has(r.id) ? { opacity: 0, x: 18 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                >
                  <span className="feed-rail" aria-hidden="true" />
                  <div className="feed-body">
                    <div className="feed-line">
                      <Package size={13} strokeWidth={1.75} />
                      <strong>{r.nome_produto || r.codigo_qr || "Leitura"}</strong>
                      {novos.has(r.id) && <em className="feed-new">novo</em>}
                    </div>
                    <div className="feed-sub">
                      <span>{r.quantidade ?? "—"} un.</span>
                      <span>{r.local_lido || "sem local"}</span>
                      <span>{tempoRelativo(r.data_hora_leitura || r.criado_em)}</span>
                    </div>
                  </div>
                  {r.fragil === "Sim" && (
                    <AlertTriangle className="feed-warn" size={13} strokeWidth={1.75} />
                  )}
                </motion.li>
              ))}
          </ol>
        </aside>
      </div>

      {/* ── Registro manual: gaveta lateral, não bloco fixo na página ── */}
      <AnimatePresence>
        {manualAberto && (
          <>
            <motion.div
              className="drawer-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setManualAberto(false)}
            />
            <motion.aside
              className="drawer"
              role="dialog"
              aria-label="Registrar leitura manual"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
            >
              <header className="drawer-head">
                <h2><ScanLine size={17} strokeWidth={1.75} /> Registrar leitura</h2>
                <button onClick={() => setManualAberto(false)} aria-label="Fechar">
                  <X size={18} strokeWidth={1.75} />
                </button>
              </header>

              <div className="drawer-body">
                <label className="field-label" htmlFor="qr">Conteúdo do QR Code</label>
                <textarea
                  id="qr"
                  className="qr-textarea"
                  value={qrText}
                  onChange={(e) => setQrText(e.target.value)}
                  placeholder={QR_EXEMPLO}
                  rows={4}
                />
                <button type="button" className="link-btn" onClick={() => setQrText(QR_EXEMPLO)}>
                  Usar QR de exemplo
                </button>

                <div className="drawer-row">
                  <div>
                    <label className="field-label" htmlFor="op">Operador</label>
                    <select id="op" className="reading-select" value={operadorId}
                      onChange={(e) => setOperadorId(e.target.value)}>
                      <option value="">— Não identificado —</option>
                      {operadores.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="st">Setor</label>
                    <select id="st" className="reading-select" value={setorId}
                      onChange={(e) => setSetorId(e.target.value)}>
                      <option value="">— Sem setor —</option>
                      {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  </div>
                </div>

                {/* Pré-visualização do que será salvo */}
                <div className="drawer-preview">
                  <span className="drawer-preview-title">
                    <QrCode size={14} strokeWidth={1.75} /> Dados que serão salvos
                  </span>
                  {preview.estruturado ? (
                    <ul>
                      <li><span>Produto</span><strong>{preview.nome_produto || "—"}</strong></li>
                      <li><span>ID</span><strong>{preview.produto_id || "—"}</strong></li>
                      <li><span>Quantidade</span><strong>{preview.quantidade ?? "—"}</strong></li>
                      <li><span>Frágil</span>
                        <strong className={preview.fragil === "Sim" ? "txt-warn" : ""}>
                          {preview.fragil || "—"}
                        </strong>
                      </li>
                      <li><span>Local</span><strong>{preview.local || "—"}</strong></li>
                    </ul>
                  ) : (
                    <p className="drawer-preview-empty">
                      Cole um QR no formato <code>PRODUTO ID: … Nome: … Quantidade: …</code> para
                      ver os campos separados.
                    </p>
                  )}
                </div>
              </div>

              <footer className="drawer-foot">
                <button className="cd-btn" onClick={() => setManualAberto(false)}>Cancelar</button>
                <button className="cd-btn go wide" onClick={registrarLeitura} disabled={saving}>
                  {saving ? "Registrando..." : "Registrar leitura"}
                </button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
