const db = require("../config/db");

exports.listar = async () => {
  const [rows] = await db.query("SELECT * FROM drones ORDER BY id ASC");
  return rows;
};

exports.criar = async ({ modelo, serial, bateria_pct, status }) => {
  if (!modelo) throw new Error("modelo é obrigatório");

  const [r] = await db.query(
    `INSERT INTO drones (modelo, serial, bateria_pct, status)
     VALUES (?, ?, ?, ?)`,
    [modelo, serial || null, bateria_pct ?? 100, status || "disponivel"]
  );

  return { id: r.insertId, modelo, serial, bateria_pct, status };
};

exports.atualizar = async (id, dados) => {
  const { modelo, serial, bateria_pct, status } = dados;
  await db.query(
    `UPDATE drones
        SET modelo = ?, serial = ?, bateria_pct = ?, status = ?
      WHERE id = ?`,
    [modelo, serial, bateria_pct, status, id]
  );

  const [rows] = await db.query("SELECT * FROM drones WHERE id = ?", [id]);
  return rows[0];
};

exports.excluir = async (id) => {
  await db.query("DELETE FROM drones WHERE id = ?", [id]);
  return { id };
};
