import test from "node:test";
import assert from "node:assert/strict";
import { resumoStats, listarEmpresas, pararLeitura, statusLeitura } from "../src/services/api.js";

const storage = { getItem: (key) => key === "usuario" ? '{"perfil":"admin"}' : null };
function setup(t, response) {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  t.after(() => { if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage); else delete globalThis.localStorage; });
  t.mock.method(globalThis, "fetch", response);
}
test("falha de rede não informa parada bem-sucedida", async (t) => {
  setup(t, async () => { throw new Error("offline"); });
  assert.equal((await pararLeitura()).sucesso, false);
});
test("leitor offline fica desconhecido, não falsamente desligado", async (t) => {
  setup(t, async () => { throw new Error("offline"); });
  const result = await statusLeitura();
  assert.equal(result.sucesso, false);
  assert.equal(result.ativa, null);
});
test("resumo falho não cria métricas zeradas", async (t) => {
  setup(t, async () => { throw new Error("offline"); });
  const result = await resumoStats();
  assert.equal(result.success, false);
  assert.equal(result.data, null);
});
test("resumo parcial não é anunciado como sincronizado", async (t) => {
  setup(t, async (url) => new Response(JSON.stringify(url.endsWith("/drones") ? { success: false, message: "Frota indisponível" } : { success: true, data: [] }), { status: url.endsWith("/drones") ? 503 : 200 }));
  const result = await resumoStats();
  assert.equal(result.success, false);
  assert.equal(result.message, "Frota indisponível");
});
test("HTTP 401 recebe instrução de sessão expirada", async (t) => {
  setup(t, async () => new Response('{"message":"Unauthorized"}', { status: 401 }));
  const result = await listarEmpresas();
  assert.equal(result.success, false);
  assert.match(result.message, /sessão expirou/);
});
test("zero é válido quando todas as fontes confirmam lista vazia", async (t) => {
  setup(t, async () => new Response('{"success":true,"data":[]}', { status: 200 }));
  const result = await resumoStats();
  assert.equal(result.success, true);
  assert.equal(result.data.leituras, 0);
});
