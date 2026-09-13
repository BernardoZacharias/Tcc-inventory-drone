/*
 * readingStats.js
 * ───────────────
 * Calcula estatísticas estruturadas a partir de uma lista de leituras.
 * Funciona tanto no modo backend quanto no modo demonstração — e
 * respeita o escopo (a lista já chega filtrada por empresa quando
 * o usuário não é admin).
 */

export function localDateKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function computeReadingStats(leituras = [], now = new Date()) {
  const total = leituras.length;

  let quantidadeTotal = 0;
  let itensFrageis = 0;
  const produtos = new Set();
  const locais = new Set();

  const porEmpresa = {};
  const porOperador = {};
  const porSetor = {};

  for (const l of leituras) {
    quantidadeTotal += Number(l.quantidade) || 0;
    if (String(l.fragil).toLowerCase() === "sim") itensFrageis++;
    if (l.produto_id) produtos.add(String(l.produto_id));
    if (l.local_lido) locais.add(String(l.local_lido));

    const emp = l.empresa || l.empresa_qr || "Não identificada";
    const ope = l.operador || "Não identificado";
    const set = l.setor || "Sem setor";

    porEmpresa[emp]  = (porEmpresa[emp]  || 0) + 1;
    porOperador[ope] = (porOperador[ope] || 0) + 1;
    porSetor[set]    = (porSetor[set]    || 0) + 1;
  }

  // Série dos últimos 7 dias
  const serie = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = localDateKey(d);
    const totalDia = leituras.filter((l) => {
      const data = l.data_hora_leitura || l.criado_em || "";
      return localDateKey(data) === iso;
    }).length;
    serie.push({ dia: iso, total: totalDia });
  }

  const hojeIso = localDateKey(now);
  const leiturasHoje = leituras.filter((l) => {
    const data = l.data_hora_leitura || l.criado_em || "";
    return localDateKey(data) === hojeIso;
  }).length;

  const toRank = (obj) =>
    Object.entries(obj)
      .map(([nome, leituras]) => ({ nome, leituras }))
      .sort((a, b) => b.leituras - a.leituras);

  return {
    total,
    quantidade_total: quantidadeTotal,
    itens_frageis: itensFrageis,
    produtos_distintos: produtos.size,
    locais_distintos: locais.size,
    leituras_hoje: leiturasHoje,
    serie_7d: serie,
    por_empresa: toRank(porEmpresa),
    por_operador: toRank(porOperador),
    por_setor: toRank(porSetor)
  };
}
