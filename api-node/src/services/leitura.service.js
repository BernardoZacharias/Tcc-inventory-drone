const db = require("../config/db");
const { parseQrCode } = require("../utils/qrParser");

/*
 * Ao criar uma leitura, o texto bruto do QR é interpretado
 * e cada informação é gravada em sua própria coluna.
 */

exports.criar = async (dados) => {
  const {
    empresa_id, codigo_qr, local_lido, status,
    operador_id, setor_id, origem
  } = dados;

  const parsed = parseQrCode(codigo_qr);
  const localFinal = parsed.local || local_lido || null;

  const [resultado] = await db.query(
    `INSERT INTO leituras
       (empresa_id, operador_id, setor_id, codigo_qr,
        produto_id, nome_produto, quantidade, fragil,
        empresa_qr, local_lido, origem, status, data_hora_leitura)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      empresa_id || null,
      operador_id || null,
      setor_id || null,
      codigo_qr || "",
      parsed.produto_id,
      parsed.nome_produto,
      parsed.quantidade,
      parsed.fragil,
      parsed.empresa_qr,
      localFinal,
      origem || "DRONE",
      status || "lido"
    ]
  );

  return {
    id: resultado.insertId,
    empresa_id: empresa_id || null,
    operador_id: operador_id || null,
    setor_id: setor_id || null,
    codigo_qr,
    produto_id: parsed.produto_id,
    nome_produto: parsed.nome_produto,
    quantidade: parsed.quantidade,
    fragil: parsed.fragil,
    empresa_qr: parsed.empresa_qr,
    local_lido: localFinal,
    origem: origem || "DRONE",
    status: status || "lido"
  };
};

const SELECT_BASE = `
  SELECT
    l.id, l.empresa_id, l.operador_id, l.setor_id,
    l.codigo_qr, l.produto_id, l.nome_produto, l.quantidade,
    l.fragil, l.empresa_qr, l.local_lido, l.origem, l.status,
    l.data_hora_leitura, l.criado_em,
    e.nome AS empresa,
    o.nome AS operador,
    s.nome AS setor
  FROM leituras l
  LEFT JOIN empresas   e ON e.id = l.empresa_id
  LEFT JOIN operadores o ON o.id = l.operador_id
  LEFT JOIN setores    s ON s.id = l.setor_id
`;

exports.listar = async () => {
  const [leituras] = await db.query(`${SELECT_BASE} ORDER BY l.id DESC`);
  return leituras;
};

exports.listarPorEmpresa = async (empresaId) => {
  const [leituras] = await db.query(
    `${SELECT_BASE} WHERE l.empresa_id = ? ORDER BY l.id DESC`,
    [empresaId]
  );
  return leituras;
};
