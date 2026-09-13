const jwt = require("jsonwebtoken");
const db = require("../config/db");

exports.registrar = async ({ nome, email, senha }) => {
  const [usuarioExistente] = await db.query(
    "SELECT id FROM usuarios WHERE email = ?",
    [email]
  );

  if (usuarioExistente.length > 0) {
    throw new Error("E-mail já cadastrado");
  }

  const [resultado] = await db.query(
    "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
    [nome, email, senha]
  );

  return {
    id: resultado.insertId,
    nome,
    email
  };
};

exports.login = async ({ email, senha }) => {
  const [usuarios] = await db.query(
    "SELECT * FROM usuarios WHERE email = ?",
    [email]
  );

  if (usuarios.length === 0) {
    throw new Error("E-mail ou senha inválidos");
  }

  const usuario = usuarios[0];

  if (senha !== usuario.senha) {
    throw new Error("E-mail ou senha inválidos");
  }

  const token = jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "8h"
    }
  );

  return {
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil || "operador",
      empresa_id: usuario.empresa_id ?? null
    }
  };
};