/*
 * qrParser.js (frontend)
 * ──────────────────────
 * Mesma lógica do parser do backend (api-node/src/utils/qrParser.js).
 * Usado no modo demonstração (localStorage) e para pré-visualizar
 * uma leitura antes de salvar.
 */

const LABELS = [
  { key: "produto_id",   re: /PRODUTO\s*ID\s*:/i },
  { key: "nome_produto", re: /NOME\s*:/i },
  { key: "quantidade",   re: /QUANTIDADE\s*:/i },
  { key: "fragil",       re: /FR[ÁA]GIL\s*:/i },
  { key: "empresa",      re: /EMPRESA\s*:/i },
  { key: "local",        re: /LOCAL\s*:/i }
];

export function parseQrCode(raw) {
  const text = String(raw || "").trim();

  const found = [];
  for (const lab of LABELS) {
    const m = lab.re.exec(text);
    if (m) found.push({ key: lab.key, start: m.index, end: m.index + m[0].length });
  }
  found.sort((a, b) => a.start - b.start);

  const out = {
    produto_id: null,
    nome_produto: null,
    quantidade: null,
    fragil: null,
    empresa_qr: null,
    local: null,
    estruturado: found.length >= 2,
    raw: text
  };

  for (let i = 0; i < found.length; i++) {
    const cur = found[i];
    const next = found[i + 1];
    let value = text.slice(cur.end, next ? next.start : text.length).trim();
    value = value.replace(/[;|]+$/g, "").trim();

    if (cur.key === "empresa") out.empresa_qr = value || null;
    else out[cur.key] = value || null;
  }

  if (out.quantidade != null) {
    const n = parseInt(String(out.quantidade).replace(/[^\d-]/g, ""), 10);
    out.quantidade = Number.isFinite(n) ? n : null;
  }
  if (out.fragil != null) {
    const f = out.fragil.toLowerCase();
    out.fragil = (f.startsWith("s") || f.startsWith("y") || f === "true" || f === "1")
      ? "Sim" : "Não";
  }

  return out;
}

/* QR de exemplo usado nos placeholders / demo */
export const QR_EXEMPLO =
  "PRODUTO ID: 12345 Nome: Teclado Logitech Quantidade: 50 " +
  "Frágil: Não Empresa: Logitech Local: Corredor A - Prateleira 3";
