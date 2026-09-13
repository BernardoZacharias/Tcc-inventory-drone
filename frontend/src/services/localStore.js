/*
 * localStore.js
 * ─────────────
 * Persistência local (localStorage) usada como fallback automático
 * quando o backend Node não está disponível.
 *
 * As leituras já são guardadas de forma ESTRUTURADA (cada campo do
 * QR Code em sua própria propriedade).
 */

import { parseQrCode } from "../utils/qrParser";

const NS = "gestock.store.v3";

function isoDaysAgo(d) {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x.toISOString();
}

const DEFAULTS = {
  empresas: [
    { id: 1, nome: "Gestock Logística",    cnpj: "12.345.678/0001-90", segmento: "Operação logística",     responsavel: "Carlos Lima", email: "carlos@gestock.com.br", telefone: "(19) 99000-0001", observacao: "", ativo: 1, criado_em: isoDaysAgo(40) },
    { id: 2, nome: "Empresa Alpha",        cnpj: "98.765.432/0001-11", segmento: "Centro de distribuição", responsavel: "Ana Souza",   email: "ana@alpha.com.br",      telefone: "(19) 99000-0002", observacao: "", ativo: 1, criado_em: isoDaysAgo(30) },
    { id: 3, nome: "Cliente Demonstração", cnpj: "",                   segmento: "Estoque técnico",        responsavel: "",            email: "",                      telefone: "",                observacao: "Conta demo", ativo: 1, criado_em: isoDaysAgo(20) }
  ],
  setores: [
    { id: 1, nome: "Recebimento", empresa_id: 2, criado_em: isoDaysAgo(30) },
    { id: 2, nome: "Expedição",   empresa_id: 1, criado_em: isoDaysAgo(30) },
    { id: 3, nome: "Armazenagem", empresa_id: 1, criado_em: isoDaysAgo(30) }
  ],
  operadores: [
    { id: 1, nome: "Vanderlei Silva", email: "vanderlei@gestock.com.br", senha: "123456", empresa_id: 2, setor_id: 1, permissoes: "leitura",            ativo: 1, criado_em: isoDaysAgo(25) },
    { id: 2, nome: "Carlos Lima",     email: "carlos@gestock.com.br",    senha: "123456", empresa_id: 1, setor_id: 2, permissoes: "leitura,relatorios", ativo: 1, criado_em: isoDaysAgo(25) }
  ],
  leituras: [
    { id: 1, empresa_id: 1, operador_id: 2, setor_id: 2, produto_id: "12345", nome_produto: "Teclado Logitech", quantidade: 50, fragil: "Não", empresa_qr: "Logitech", local_lido: "Corredor A - Prateleira 3", origem: "DRONE", status: "lido",
      codigo_qr: "PRODUTO ID: 12345 Nome: Teclado Logitech Quantidade: 50 Frágil: Não Empresa: Logitech Local: Corredor A - Prateleira 3", data_hora_leitura: isoDaysAgo(1), criado_em: isoDaysAgo(1) },
    { id: 2, empresa_id: 1, operador_id: 2, setor_id: 3, produto_id: "12346", nome_produto: "Monitor Dell 24", quantidade: 18, fragil: "Sim", empresa_qr: "Dell", local_lido: "Corredor B - Prateleira 1", origem: "DRONE", status: "lido",
      codigo_qr: "PRODUTO ID: 12346 Nome: Monitor Dell 24 Quantidade: 18 Frágil: Sim Empresa: Dell Local: Corredor B - Prateleira 1", data_hora_leitura: isoDaysAgo(2), criado_em: isoDaysAgo(2) },
    { id: 3, empresa_id: 2, operador_id: 1, setor_id: 1, produto_id: "20011", nome_produto: "Caixa de Parafusos", quantidade: 200, fragil: "Não", empresa_qr: "Alpha Suprimentos", local_lido: "Doca 2 - Pallet 7", origem: "DRONE", status: "lido",
      codigo_qr: "PRODUTO ID: 20011 Nome: Caixa de Parafusos Quantidade: 200 Frágil: Não Empresa: Alpha Suprimentos Local: Doca 2 - Pallet 7", data_hora_leitura: isoDaysAgo(2), criado_em: isoDaysAgo(2) },
    { id: 4, empresa_id: 1, operador_id: 2, setor_id: 2, produto_id: "12347", nome_produto: "Mouse Gamer", quantidade: 75, fragil: "Não", empresa_qr: "Logitech", local_lido: "Corredor A - Prateleira 5", origem: "DRONE", status: "lido",
      codigo_qr: "PRODUTO ID: 12347 Nome: Mouse Gamer Quantidade: 75 Frágil: Não Empresa: Logitech Local: Corredor A - Prateleira 5", data_hora_leitura: isoDaysAgo(3), criado_em: isoDaysAgo(3) },
    { id: 5, empresa_id: 2, operador_id: 1, setor_id: 1, produto_id: "20012", nome_produto: "Vidro Temperado", quantidade: 12, fragil: "Sim", empresa_qr: "Alpha Suprimentos", local_lido: "Doca 1 - Pallet 3", origem: "DRONE", status: "lido",
      codigo_qr: "PRODUTO ID: 20012 Nome: Vidro Temperado Quantidade: 12 Frágil: Sim Empresa: Alpha Suprimentos Local: Doca 1 - Pallet 3", data_hora_leitura: isoDaysAgo(4), criado_em: isoDaysAgo(4) },
    { id: 6, empresa_id: 1, operador_id: 2, setor_id: 3, produto_id: "12348", nome_produto: "Webcam HD", quantidade: 40, fragil: "Sim", empresa_qr: "Logitech", local_lido: "Corredor C - Prateleira 2", origem: "DRONE", status: "lido",
      codigo_qr: "PRODUTO ID: 12348 Nome: Webcam HD Quantidade: 40 Frágil: Sim Empresa: Logitech Local: Corredor C - Prateleira 2", data_hora_leitura: isoDaysAgo(5), criado_em: isoDaysAgo(5) }
  ],
  operacoes: [
    { id: 1, empresa_id: 1, titulo: "Inventário corredor A", descricao: "Conferência mensal", piloto: "João",  area_voo: "Corredor A", status: "em_andamento", criado_em: isoDaysAgo(3) },
    { id: 2, empresa_id: 2, titulo: "Auditoria semestral",  descricao: "Setor refrigerados", piloto: "Maria", area_voo: "Setor B",    status: "concluida",    criado_em: isoDaysAgo(10) }
  ],
  relatorios: [
    { id: 1, empresa_id: 1, titulo: "Inventário mensal", tipo: "mensal", periodo_ini: "2026-04-01", periodo_fim: "2026-04-30", total_lidos: 124, total_erros: 3, gerado_por: "sistema", criado_em: isoDaysAgo(8) }
  ],
  alertas: [
    { id: 1, empresa_id: 1, tipo: "aviso",   mensagem: "Bateria do drone DJI-MV3-001 em 30%", lido: 0, criado_em: isoDaysAgo(0) },
    { id: 2, empresa_id: null, tipo: "info", mensagem: "Sistema atualizado para versão 2.0",  lido: 1, criado_em: isoDaysAgo(1) },
    { id: 3, empresa_id: 2, tipo: "critico", mensagem: "Leitura divergente detectada no setor de recebimento", lido: 0, criado_em: isoDaysAgo(0) }
  ],
  drones: [
    { id: 1, modelo: "DJI Mavic 3 Enterprise", serial: "DJI-MV3-001", bateria_pct: 92,  status: "disponivel" },
    { id: 2, modelo: "Skydio X10",             serial: "SKY-X10-014", bateria_pct: 78,  status: "manutencao" },
    { id: 3, modelo: "Parrot Anafi Ai",        serial: "PRT-ANF-022", bateria_pct: 100, status: "disponivel" }
  ]
};

function load() {
  try {
    const raw = localStorage.getItem(NS);
    if (!raw) {
      localStorage.setItem(NS, JSON.stringify(DEFAULTS));
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
    return JSON.parse(raw);
  } catch {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

function save(state) {
  try { localStorage.setItem(NS, JSON.stringify(state)); } catch { /* Legacy store may be unavailable in private browsing. */ }
}

function nextId(items) {
  return items.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
}
function nowIso() { return new Date().toISOString(); }

/* Enriquecе uma leitura com os nomes relacionados (joins). */
function joinLeitura(l, s) {
  return {
    ...l,
    empresa:  s.empresas.find((e) => e.id === l.empresa_id)?.nome || null,
    operador: s.operadores.find((o) => o.id === l.operador_id)?.nome || null,
    setor:    s.setores.find((x) => x.id === l.setor_id)?.nome || null
  };
}

/* ── Empresas ─────────────────────────────────── */
export const localEmpresas = {
  list() {
    const s = load();
    return s.empresas
      .map((e) => ({
        ...e,
        total_leituras: s.leituras.filter((l) => l.empresa_id === e.id).length
      }))
      .sort((a, b) => b.id - a.id);
  },
  get(id) { return load().empresas.find((x) => x.id === Number(id)); },
  create(data) {
    const s = load();
    const item = { id: nextId(s.empresas), ...data, ativo: 1, criado_em: nowIso() };
    s.empresas.unshift(item);
    save(s);
    return item;
  },
  update(id, data) {
    const s = load();
    const i = s.empresas.findIndex((x) => x.id === Number(id));
    if (i < 0) return null;
    s.empresas[i] = { ...s.empresas[i], ...data };
    save(s);
    return s.empresas[i];
  },
  remove(id) {
    const s = load();
    s.empresas = s.empresas.filter((x) => x.id !== Number(id));
    s.leituras = s.leituras.filter((x) => x.empresa_id !== Number(id));
    save(s);
    return { id };
  }
};

/* ── Setores ──────────────────────────────────── */
export const localSetores = {
  list() {
    const s = load();
    return s.setores
      .map((x) => ({
        ...x,
        empresa_nome: s.empresas.find((e) => e.id === x.empresa_id)?.nome || null,
        total_leituras: s.leituras.filter((l) => l.setor_id === x.id).length
      }))
      .sort((a, b) => b.id - a.id);
  },
  create({ nome, empresa_id }) {
    const s = load();
    const item = {
      id: nextId(s.setores),
      nome,
      empresa_id: empresa_id ? Number(empresa_id) : null,
      criado_em: nowIso()
    };
    s.setores.unshift(item);
    save(s);
    return item;
  },
  remove(id) {
    const s = load();
    s.setores = s.setores.filter((x) => x.id !== Number(id));
    save(s);
    return { id };
  }
};

/* ── Operadores ───────────────────────────────── */
export const localOperadores = {
  list() {
    const s = load();
    return s.operadores
      .map((o) => ({
        ...o,
        empresa_nome: s.empresas.find((e) => e.id === o.empresa_id)?.nome || null,
        setor_nome: s.setores.find((x) => x.id === o.setor_id)?.nome || null
      }))
      .sort((a, b) => b.id - a.id);
  },
  findByEmail(email) {
    const e = String(email || "").toLowerCase();
    return load().operadores.find((o) => String(o.email).toLowerCase() === e) || null;
  },
  create(data) {
    const s = load();
    if (s.operadores.some((o) => String(o.email).toLowerCase() === String(data.email).toLowerCase())) {
      throw new Error("E-mail já cadastrado");
    }
    const item = {
      id: nextId(s.operadores),
      nome: data.nome,
      email: data.email,
      senha: data.senha || "123456",
      empresa_id: data.empresa_id ? Number(data.empresa_id) : null,
      setor_id: data.setor_id ? Number(data.setor_id) : null,
      permissoes: Array.isArray(data.permissoes) ? data.permissoes.join(",") : (data.permissoes || "leitura"),
      ativo: 1,
      criado_em: nowIso()
    };
    s.operadores.unshift(item);
    save(s);
    return item;
  },
  update(id, data) {
    const s = load();
    const i = s.operadores.findIndex((x) => x.id === Number(id));
    if (i < 0) return null;
    s.operadores[i] = {
      ...s.operadores[i],
      ...data,
      permissoes: Array.isArray(data.permissoes)
        ? data.permissoes.join(",")
        : (data.permissoes ?? s.operadores[i].permissoes)
    };
    save(s);
    return s.operadores[i];
  },
  remove(id) {
    const s = load();
    s.operadores = s.operadores.filter((x) => x.id !== Number(id));
    save(s);
    return { id };
  }
};

/* ── Leituras (estruturadas) ──────────────────── */
export const localLeituras = {
  list() {
    const s = load();
    return s.leituras.map((l) => joinLeitura(l, s)).sort((a, b) => b.id - a.id);
  },
  byEmpresa(id) {
    const s = load();
    return s.leituras
      .filter((l) => l.empresa_id === Number(id))
      .map((l) => joinLeitura(l, s))
      .sort((a, b) => b.id - a.id);
  },
  create(data) {
    const s = load();
    const parsed = parseQrCode(data.codigo_qr);
    const item = {
      id: nextId(s.leituras),
      empresa_id: data.empresa_id ? Number(data.empresa_id) : null,
      operador_id: data.operador_id ? Number(data.operador_id) : null,
      setor_id: data.setor_id ? Number(data.setor_id) : null,
      codigo_qr: data.codigo_qr || "",
      produto_id: parsed.produto_id,
      nome_produto: parsed.nome_produto,
      quantidade: parsed.quantidade,
      fragil: parsed.fragil,
      empresa_qr: parsed.empresa_qr,
      local_lido: parsed.local || data.local_lido || null,
      origem: data.origem || "DRONE",
      status: data.status || "lido",
      data_hora_leitura: nowIso(),
      criado_em: nowIso()
    };
    s.leituras.unshift(item);
    save(s);
    return joinLeitura(item, s);
  }
};

/* ── Operações ────────────────────────────────── */
export const localOperacoes = {
  list() {
    const s = load();
    return s.operacoes
      .map((o) => ({ ...o, empresa_nome: s.empresas.find((e) => e.id === o.empresa_id)?.nome }))
      .sort((a, b) => b.id - a.id);
  },
  create(data) {
    const s = load();
    const empresa = s.empresas.find((e) => e.id === Number(data.empresa_id));
    const item = {
      id: nextId(s.operacoes),
      ...data,
      empresa_id: Number(data.empresa_id),
      empresa_nome: empresa?.nome,
      status: data.status || "em_andamento",
      criado_em: nowIso()
    };
    s.operacoes.unshift(item);
    save(s);
    return item;
  },
  setStatus(id, status) {
    const s = load();
    const i = s.operacoes.findIndex((x) => x.id === Number(id));
    if (i < 0) return null;
    s.operacoes[i].status = status;
    if (status === "concluida" || status === "cancelada") s.operacoes[i].finalizada_em = nowIso();
    save(s);
    return s.operacoes[i];
  },
  remove(id) {
    const s = load();
    s.operacoes = s.operacoes.filter((x) => x.id !== Number(id));
    save(s);
    return { id };
  }
};

/* ── Relatórios ───────────────────────────────── */
export const localRelatorios = {
  list() {
    const s = load();
    return s.relatorios
      .map((r) => ({ ...r, empresa_nome: s.empresas.find((e) => e.id === r.empresa_id)?.nome }))
      .sort((a, b) => b.id - a.id);
  },
  create({ empresa_id, tipo, periodo_ini, periodo_fim, titulo, gerado_por }) {
    const s = load();
    const empresa = s.empresas.find((e) => e.id === Number(empresa_id));
    const leituras = s.leituras.filter((l) => l.empresa_id === Number(empresa_id));
    const item = {
      id: nextId(s.relatorios),
      empresa_id: Number(empresa_id),
      empresa_nome: empresa?.nome,
      titulo: titulo || `Relatório ${tipo || "customizado"}`,
      tipo: tipo || "customizado",
      periodo_ini: periodo_ini || null,
      periodo_fim: periodo_fim || null,
      total_lidos: leituras.length,
      total_erros: leituras.filter((l) => l.status !== "lido").length,
      gerado_por: gerado_por || "local",
      criado_em: nowIso()
    };
    s.relatorios.unshift(item);
    save(s);
    return item;
  },
  remove(id) {
    const s = load();
    s.relatorios = s.relatorios.filter((x) => x.id !== Number(id));
    save(s);
    return { id };
  }
};

/* ── Alertas ──────────────────────────────────── */
export const localAlertas = {
  list() {
    const s = load();
    return s.alertas
      .map((a) => ({ ...a, empresa_nome: s.empresas.find((e) => e.id === a.empresa_id)?.nome || null }))
      .sort((a, b) => b.id - a.id);
  },
  create({ empresa_id, tipo, mensagem }) {
    const s = load();
    const item = {
      id: nextId(s.alertas),
      empresa_id: empresa_id ? Number(empresa_id) : null,
      tipo: tipo || "info",
      mensagem,
      lido: 0,
      criado_em: nowIso()
    };
    s.alertas.unshift(item);
    save(s);
    return item;
  },
  markRead(id) {
    const s = load();
    const i = s.alertas.findIndex((x) => x.id === Number(id));
    if (i < 0) return null;
    s.alertas[i].lido = 1;
    save(s);
    return s.alertas[i];
  },
  remove(id) {
    const s = load();
    s.alertas = s.alertas.filter((x) => x.id !== Number(id));
    save(s);
    return { id };
  }
};

/* ── Drones ───────────────────────────────────── */
export const localDrones = {
  list() { return load().drones; },
  create(data) {
    const s = load();
    const item = { id: nextId(s.drones), ...data };
    s.drones.push(item);
    save(s);
    return item;
  },
  update(id, data) {
    const s = load();
    const i = s.drones.findIndex((x) => x.id === Number(id));
    if (i < 0) return null;
    s.drones[i] = { ...s.drones[i], ...data, id: s.drones[i].id };
    save(s);
    return s.drones[i];
  },
  remove(id) {
    const s = load();
    s.drones = s.drones.filter((x) => x.id !== Number(id));
    save(s);
    return { id };
  }
};
