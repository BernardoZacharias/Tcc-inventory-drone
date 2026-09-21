import test from "node:test";
import assert from "node:assert/strict";
import { resumoStats, listarEmpresas, pararLeitura, statusLeitura,
         rearmarAvisoDeSessao, EVENTO_SESSAO_EXPIRADA } from "../src/shared/services/api.js";

const storage = {
  itens: { usuario: '{"perfil":"admin"}', token: "jwt-de-ontem" },
  getItem(key) { return this.itens[key] ?? null; },
  setItem(key, valor) { this.itens[key] = valor; },
  removeItem(key) { delete this.itens[key]; },
};
function setup(t, response) {
  storage.itens = { usuario: '{"perfil":"admin"}', token: "jwt-de-ontem" };
  rearmarAvisoDeSessao();
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
test("HTTP 401 encerra a sessão em vez de deixar o usuário preso", async (t) => {
  setup(t, async () => new Response('{"message":"Unauthorized"}', { status: 401 }));
  await listarEmpresas();
  assert.equal(storage.getItem("token"), null, "o token expirado continuou guardado");
  assert.equal(storage.getItem("usuario"), null, "o usuário continuou na sessão");
});
test("HTTP 401 avisa o app uma única vez, mesmo com várias chamadas", async (t) => {
  setup(t, async () => new Response('{"message":"Unauthorized"}', { status: 401 }));

  // O Node não tem addEventListener no globalThis; observar o despacho
  // testa exatamente o contrato que o App consome no navegador.
  const avisos = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, "dispatchEvent");
  Object.defineProperty(globalThis, "dispatchEvent", {
    value: (evento) => { avisos.push(evento.type); return true; },
    configurable: true,
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "dispatchEvent", original);
    else delete globalThis.dispatchEvent;
  });

  // Uma tela dispara várias chamadas juntas: todas voltam 401.
  await Promise.all([listarEmpresas(), listarEmpresas(), listarEmpresas()]);
  assert.deepEqual(avisos, [EVENTO_SESSAO_EXPIRADA],
    "o usuário levaria um aviso por requisição");
});
test("zero é válido quando todas as fontes confirmam lista vazia", async (t) => {
  setup(t, async () => new Response('{"success":true,"data":[]}', { status: 200 }));
  const result = await resumoStats();
  assert.equal(result.success, true);
  assert.equal(result.data.leituras, 0);
});

test("requisições do painel seguem a porta real da API desktop", async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    gestock: { desktop: true, info: async () => ({ apiUrl: "http://127.0.0.1:3006" }) },
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete globalThis.window;
  });
  const urls = [];
  setup(t, async (url) => { urls.push(url); return new Response('{"success":true,"data":[]}'); });
  assert.equal((await listarEmpresas()).success, true);
  assert.deepEqual(urls, ["http://127.0.0.1:3006/api/empresas"]);
});
