/** A reachable API is not proof that the database or drone is ready. */
export function preflightStatus(status, payload) {
  if (status === 401 || status === 403) {
    return { api: ["ok", "conectado"], banco: ["alerta", "entre para verificar"] };
  }
  if (status >= 200 && status < 300 && payload?.success !== false && Array.isArray(payload?.data)) {
    const total = payload.data.length;
    return { api: ["ok", "conectado"], banco: ["ok", `${total} empresa${total === 1 ? "" : "s"}`] };
  }
  return { api: ["alerta", status >= 400 ? `resposta ${status}` : "resposta inesperada"], banco: ["alerta", "não verificado"] };
}
