/*
 * api.js
 * ──────
 * Cliente da API — usa SOMENTE o backend real (api-node).
 * Não há mais modo demonstração / fallback para localStorage.
 *
 * Controle de acesso por escopo: usuário comum só enxerga
 * os dados da própria empresa.
 */

import { computeReadingStats } from "../utils/readingStats.js";
import { isAdmin, currentEmpresaId } from "../utils/auth.js";

export const API_URL = (import.meta.env?.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "");
const TIMEOUT_MS = 5000;

let _backendOnline = null;

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchWithTimeout(url, opts = {}, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Faz a requisição ao backend.
 * Retorna o JSON da resposta, ou null se o servidor estiver fora do ar.
 */
async function request(path, { method = "GET", body, timeout } = {}) {
  try {
    const r = await fetchWithTimeout(`${API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: body ? JSON.stringify(body) : undefined
    }, timeout || TIMEOUT_MS);
    _backendOnline = r.status < 500;
    const data = await r.json();
    if (!r.ok) {
      const message = r.status === 401
        ? "Sua sessão expirou. Saia e entre novamente para continuar."
        : data.message || data.mensagem || "Não foi possível concluir a solicitação. Tente novamente.";
      return { ...data, success: false, sucesso: false, message, mensagem: message };
    }
    return data;
  } catch {
    _backendOnline = false;
    return null;
  }
}

const OFFLINE_MSG =
  "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";

const offlineList = () => ({ success: false, message: OFFLINE_MSG, data: [] });
const offline     = () => ({ success: false, message: OFFLINE_MSG });

/* ── Escopo por empresa (permissões por camada) ── */
function scopeEmpresas(list) {
  if (isAdmin()) return list;
  const eid = currentEmpresaId();
  return eid == null ? list : list.filter((e) => e.id === eid);
}
function scopeByEmpresaId(list) {
  if (isAdmin()) return list;
  const eid = currentEmpresaId();
  return eid == null ? list : list.filter((x) => x.empresa_id === eid);
}
function scopeAlertas(list) {
  if (isAdmin()) return list;
  const eid = currentEmpresaId();
  return eid == null ? list : list.filter((x) => x.empresa_id == null || x.empresa_id === eid);
}

/* ════════════════════════════════════════════════════════
   LEITOR (drone Python)
   ════════════════════════════════════════════════════════ */
export async function iniciarLeitura(empresaId) {
  const r = await request("/leitura/iniciar", {
    method: "POST",
    body: { empresa_id: empresaId },
    timeout: 9000
  });
  return r || { sucesso: false, mensagem: "Backend offline — inicie o servidor api-node." };
}

export async function pararLeitura() {
  const r = await request("/leitura/parar", { method: "POST" });
  return r || { sucesso: false, mensagem: "Não foi possível confirmar a parada. Verifique o leitor antes de continuar." };
}

export async function statusLeitura() {
  const r = await request("/leitura/status");
  return r || { sucesso: false, ativa: null, mensagem: "Estado do leitor indisponível. Tente reconectar." };
}

/* ════════════════════════════════════════════════════════
   LEITURAS
   ════════════════════════════════════════════════════════ */
export async function listarLeituras() {
  const r = await request("/leituras");
  if (!r) return offlineList();
  if (r.success) r.data = scopeByEmpresaId(r.data || []);
  return r;
}

export async function leiturasPorEmpresa(id) {
  const r = await request(`/leituras/empresa/${id}`);
  return r || offlineList();
}

export async function criarLeitura(data) {
  if (!data?.codigo_qr?.trim()) {
    return { success: false, message: "Informe o conteúdo do QR Code" };
  }
  const r = await request("/leituras", { method: "POST", body: data });
  return r || offline();
}

/* ════════════════════════════════════════════════════════
   EMPRESAS
   ════════════════════════════════════════════════════════ */
export async function listarEmpresas() {
  const r = await request("/empresas");
  if (!r) return offlineList();
  if (r.success) r.data = scopeEmpresas(r.data || []);
  return r;
}

export async function obterEmpresa(id) {
  const r = await request(`/empresas/${id}`);
  return r || offline();
}

export async function criarEmpresa(data) {
  if (!data?.nome?.trim()) return { success: false, message: "Nome da empresa é obrigatório" };
  const r = await request("/empresas", { method: "POST", body: data });
  return r || offline();
}

export async function atualizarEmpresa(id, data) {
  const r = await request(`/empresas/${id}`, { method: "PUT", body: data });
  return r || offline();
}

export async function excluirEmpresa(id) {
  const r = await request(`/empresas/${id}`, { method: "DELETE" });
  return r || offline();
}

/* ════════════════════════════════════════════════════════
   OPERADORES
   ════════════════════════════════════════════════════════ */
export async function listarOperadores() {
  const r = await request("/operadores");
  if (!r) return offlineList();
  if (r.success) r.data = scopeByEmpresaId(r.data || []);
  return r;
}

export async function criarOperador(data) {
  if (!data?.nome?.trim() || !data?.email?.trim()) {
    return { success: false, message: "Nome e e-mail são obrigatórios" };
  }
  const r = await request("/operadores", { method: "POST", body: data });
  return r || offline();
}

export async function atualizarOperador(id, data) {
  const r = await request(`/operadores/${id}`, { method: "PUT", body: data });
  return r || offline();
}

export async function excluirOperador(id) {
  const r = await request(`/operadores/${id}`, { method: "DELETE" });
  return r || offline();
}

/* ════════════════════════════════════════════════════════
   SETORES
   ════════════════════════════════════════════════════════ */
export async function listarSetores() {
  const r = await request("/setores");
  if (!r) return offlineList();
  if (r.success) r.data = scopeByEmpresaId(r.data || []);
  return r;
}

export async function criarSetor(data) {
  if (!data?.nome?.trim()) return { success: false, message: "Informe o nome do setor" };
  const r = await request("/setores", { method: "POST", body: data });
  return r || offline();
}

export async function excluirSetor(id) {
  const r = await request(`/setores/${id}`, { method: "DELETE" });
  return r || offline();
}

/* ════════════════════════════════════════════════════════
   OPERAÇÕES
   ════════════════════════════════════════════════════════ */
export async function listarOperacoes() {
  const r = await request("/operacoes");
  if (!r) return offlineList();
  if (r.success) r.data = scopeByEmpresaId(r.data || []);
  return r;
}

export async function criarOperacao(data) {
  if (!data?.empresa_id || !data?.titulo) {
    return { success: false, message: "Selecione a empresa e informe o título" };
  }
  const r = await request("/operacoes", { method: "POST", body: data });
  return r || offline();
}

export async function setOperacaoStatus(id, status) {
  const r = await request(`/operacoes/${id}/status`, { method: "PATCH", body: { status } });
  return r || offline();
}

export async function excluirOperacao(id) {
  const r = await request(`/operacoes/${id}`, { method: "DELETE" });
  return r || offline();
}

/* ════════════════════════════════════════════════════════
   RELATÓRIOS
   ════════════════════════════════════════════════════════ */
export async function listarRelatorios() {
  const r = await request("/relatorios");
  if (!r) return offlineList();
  if (r.success) r.data = scopeByEmpresaId(r.data || []);
  return r;
}

export async function gerarRelatorio(data) {
  if (!data?.empresa_id) return { success: false, message: "Selecione uma empresa" };
  const r = await request("/relatorios", { method: "POST", body: data });
  return r || offline();
}

export async function excluirRelatorio(id) {
  const r = await request(`/relatorios/${id}`, { method: "DELETE" });
  return r || offline();
}

/* ════════════════════════════════════════════════════════
   ALERTAS
   ════════════════════════════════════════════════════════ */
export async function listarAlertas() {
  const r = await request("/alertas");
  if (!r) return offlineList();
  if (r.success) r.data = scopeAlertas(r.data || []);
  return r;
}

export async function criarAlerta(data) {
  if (!data?.mensagem?.trim()) return { success: false, message: "Digite a mensagem do alerta" };
  const r = await request("/alertas", { method: "POST", body: data });
  return r || offline();
}

export async function marcarAlertaLido(id) {
  const r = await request(`/alertas/${id}/lido`, { method: "PATCH" });
  return r || offline();
}

export async function excluirAlerta(id) {
  const r = await request(`/alertas/${id}`, { method: "DELETE" });
  return r || offline();
}

/* ════════════════════════════════════════════════════════
   DRONES
   ════════════════════════════════════════════════════════ */
export async function listarDrones() {
  const r = await request("/drones");
  return r || offlineList();
}

export async function criarDrone(data) {
  if (!data?.modelo?.trim()) return { success: false, message: "Informe o modelo do drone" };
  const r = await request("/drones", { method: "POST", body: data });
  return r || offline();
}

export async function atualizarDrone(id, data) {
  const r = await request(`/drones/${id}`, { method: "PUT", body: data });
  return r || offline();
}

export async function excluirDrone(id) {
  const r = await request(`/drones/${id}`, { method: "DELETE" });
  return r || offline();
}

/* ════════════════════════════════════════════════════════
   STATS — derivado das leituras já filtradas por escopo
   ════════════════════════════════════════════════════════ */
export async function resumoStats() {
  const [leiturasRes, empresasRes, operacoesRes, relatoriosRes, alertasRes, dronesRes, operadoresRes] =
    await Promise.all([
      listarLeituras(), listarEmpresas(), listarOperacoes(),
      listarRelatorios(), listarAlertas(), listarDrones(), listarOperadores()
    ]);

  const failed = [leiturasRes, empresasRes, operacoesRes, relatoriosRes, alertasRes, dronesRes, operadoresRes].find((result) => !result.success);
  if (failed) return { success: false, message: failed.message || OFFLINE_MSG, data: null };

  const leituras = leiturasRes.data || [];
  const stats = computeReadingStats(leituras);

  return {
    success: true,
    data: {
      ...stats,
      empresas:   (empresasRes.data || []).length,
      leituras:   leituras.length,
      operacoes:  (operacoesRes.data || []).length,
      relatorios: (relatoriosRes.data || []).length,
      operadores: (operadoresRes.data || []).length,
      alertas:    (alertasRes.data || []).filter((a) => !a.lido).length,
      drones_disponiveis: (dronesRes.data || []).filter((d) => d.status === "disponivel").length,
      top_empresas: stats.por_empresa.slice(0, 5).map((x, i) => ({ id: i, nome: x.nome, leituras: x.leituras }))
    }
  };
}

export function backendStatus() {
  return _backendOnline;
}
