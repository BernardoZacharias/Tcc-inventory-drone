import test from "node:test";
import assert from "node:assert/strict";
import { API_URL, createApiEndpointResolver } from "../src/shared/services/apiEndpoint.js";
import { preflightStatus } from "../src/dashboard/utils/preflightStatus.js";
import { defaultRoute, resolveRoute } from "../src/shared/utils/navigation.js";

function desktop(t, info) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { gestock: { desktop: true, info } } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete globalThis.window;
  });
}

test("navegador mantém a URL configurada", async () => {
  assert.equal(await createApiEndpointResolver()(), API_URL);
});
test("aplicativo usa a porta livre informada pelo Electron em chamadas simultâneas", async (t) => {
  let calls = 0;
  desktop(t, async () => { calls++; return { apiUrl: "http://127.0.0.1:3007" }; });
  const resolve = createApiEndpointResolver();
  assert.deepEqual(await Promise.all([resolve(), resolve(), resolve()]), Array(3).fill("http://127.0.0.1:3007/api"));
  assert.equal(calls, 1);
});
test("falha na ponte não envia credenciais a uma API de fallback e permite nova tentativa", async (t) => {
  let calls = 0;
  desktop(t, async () => ++calls === 1 ? { apiUrl: null } : { apiUrl: "http://127.0.0.1:3002/" });
  const resolve = createApiEndpointResolver();
  await assert.rejects(resolve(), /não está disponível/);
  assert.equal(await resolve(), "http://127.0.0.1:3002/api");
});
test("ponte sem resposta tem limite de espera", async (t) => {
  desktop(t, () => new Promise(() => {}));
  await assert.rejects(createApiEndpointResolver({ timeoutMs: 10 })(), /não informou/);
});
test("endereço desktop externo é rejeitado", async (t) => {
  desktop(t, async () => ({ apiUrl: "https://example.invalid" }));
  await assert.rejects(createApiEndpointResolver()(), /inválido/);
});
test("aplicativo abre no login ou no trabalho, nunca nas páginas de marketing", (t) => {
  desktop(t, async () => ({}));
  assert.equal(defaultRoute(false), "login");
  assert.equal(defaultRoute(true), "dashboard");
  for (const page of ["home", "about", "technology", "contact", "unknown"]) {
    assert.equal(resolveRoute(page, null, false).page, "login");
    assert.equal(resolveRoute(page, null, true).page, "dashboard");
  }
});
test("pré-voo diferencia autenticação necessária de serviço offline", () => {
  for (const code of [401, 403]) {
    assert.deepEqual(preflightStatus(code, {}).api, ["ok", "conectado"]);
    assert.deepEqual(preflightStatus(code, {}).banco, ["alerta", "entre para verificar"]);
  }
});
test("pré-voo só confirma banco quando há uma lista válida", () => {
  assert.deepEqual(preflightStatus(200, { success: true, data: [] }).banco, ["ok", "0 empresas"]);
  assert.deepEqual(preflightStatus(200, { success: true, data: [{}] }).banco, ["ok", "1 empresa"]);
  for (const payload of [null, { data: "unexpected" }, { success: false, data: [] }]) {
    assert.deepEqual(preflightStatus(200, payload).banco, ["alerta", "não verificado"]);
  }
  assert.deepEqual(preflightStatus(503, {}).banco, ["alerta", "não verificado"]);
});
