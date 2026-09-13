/*
 * qrParser.js
 * ───────────
 * Converte o TEXTO bruto de um QR Code em um objeto estruturado.
 *
 * Exemplo de entrada:
 *   "PRODUTO ID: 12345 Nome: Teclado Logitech Quantidade: 50
 *    Frágil: Não Empresa: Logitech Local: Corredor A - Prateleira 3"
 *
 * Saída:
 *   {
 *     produto_id: "12345",
 *     nome_produto: "Teclado Logitech",
 *     quantidade: 50,
 *     fragil: "Não",
 *     empresa_qr: "Logitech",
 *     local: "Corredor A - Prateleira 3",
 *     estruturado: true,
 *     raw: "<texto original>"
 *   }
 */

// Rótulos reconhecidos, na ordem em que costumam aparecer.
const LABELS = [
  { key: "produto_id",   re: /PRODUTO\s*ID\s*:/i },
  { key: "nome_produto", re: /NOME\s*:/i },
  { key: "quantidade",   re: /QUANTIDADE\s*:/i },
  { key: "fragil",       re: /FR[ÁA]GIL\s*:/i },
  { key: "empresa",      re: /EMPRESA\s*:/i },
  { key: "local",        re: /LOCAL\s*:/i }
];

function parseQrCode(raw) {
  const text = String(raw || "").trim();

  // Localiza a posição de cada rótulo presente no texto.
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

  // O valor de cada campo é o texto entre o fim do rótulo atual
  // e o início do próximo rótulo.
  for (let i = 0; i < found.length; i++) {
    const cur = found[i];
    const next = found[i + 1];
    let value = text.slice(cur.end, next ? next.start : text.length).trim();
    value = value.replace(/[;|]+$/g, "").trim();

    if (cur.key === "empresa") out.empresa_qr = value || null;
    else out[cur.key] = value || null;
  }

  // Normaliza quantidade -> número inteiro
  if (out.quantidade != null) {
    const n = parseInt(String(out.quantidade).replace(/[^\d-]/g, ""), 10);
    out.quantidade = Number.isFinite(n) ? n : null;
  }

  // Normaliza frágil -> "Sim" / "Não"
  if (out.fragil != null) {
    const f = out.fragil.toLowerCase();
    out.fragil = (f.startsWith("s") || f.startsWith("y") || f === "true" || f === "1")
      ? "Sim" : "Não";
  }

  return out;
}

module.exports = { parseQrCode };
