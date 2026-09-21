/*
 * auth.js
 * ───────
 * Controle de acesso por camadas (perfil de usuário).
 *
 *  - admin@gestock.com.br  -> perfil "admin": acessa TODAS as empresas
 *  - demais usuários       -> perfil "operador": só veem a empresa deles
 */

const ADMIN_EMAILS = ["admin@gestock.com.br", "admin@gestock.com"];

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "null");
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  localStorage.setItem("usuario", JSON.stringify(user));
}

export function isAdmin() {
  const u = getCurrentUser();
  if (!u) return false;
  if (u.perfil === "admin") return true;
  return ADMIN_EMAILS.includes(String(u.email || "").toLowerCase());
}

/**
 * Retorna o empresa_id ao qual o usuário está restrito.
 * Para admin retorna null (= sem restrição, vê tudo).
 */
export function currentEmpresaId() {
  if (isAdmin()) return null;
  const u = getCurrentUser();
  return u?.empresa_id ?? null;
}

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || "").toLowerCase());
}

export function logout() {
  localStorage.removeItem("usuario");
  localStorage.removeItem("token");
}
