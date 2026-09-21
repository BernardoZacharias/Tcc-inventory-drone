import test from "node:test";
import assert from "node:assert/strict";
import { resolveRoute } from "../src/shared/utils/navigation.js";
import { computeReadingStats, localDateKey } from "../src/shared/utils/readingStats.js";

test("páginas públicas abrem sem sessão", () => {
  for (const page of ["home", "login", "about", "technology", "contact"]) assert.equal(resolveRoute(page, null, false).page, page);
});
test("páginas operacionais direcionam ao login sem sessão", () => {
  for (const page of ["dashboard", "companies", "operators", "reading", "reports"]) assert.equal(resolveRoute(page, null, false).page, "login");
});
test("rota desconhecida tem destino seguro", () => assert.equal(resolveRoute("missing", null, true).page, "home"));
test("painel de empresa exige contexto e preserva seleção válida", () => {
  assert.equal(resolveRoute("company", null, true).page, "companies");
  const company = { id: 7, name: "Empresa" };
  assert.deepEqual(resolveRoute("company", company, true), { page: "company", company });
});
test("datas puras não perdem um dia por UTC", () => assert.equal(localDateKey("2026-09-13"), "2026-09-13"));
test("datas locais e inválidas são tratadas", () => {
  assert.equal(localDateKey(new Date(2026, 8, 13, 23, 59)), "2026-09-13");
  assert.equal(localDateKey("invalid"), "");
});
test("estatísticas vazias preservam sete dias e total zero", () => {
  const result = computeReadingStats([], new Date(2026, 8, 13, 10));
  assert.equal(result.total, 0);
  assert.equal(result.serie_7d.length, 7);
  assert.deepEqual(result.serie_7d.at(-1), { dia: "2026-09-13", total: 0 });
});
test("hoje e série usam a mesma data local, com totais estruturados", () => {
  const now = new Date(2026, 8, 13, 23, 30);
  const readings = [
    { criado_em: now.toISOString(), quantidade: "12", fragil: "Sim", produto_id: "A", empresa: "Atlas", local_lido: "01" },
    { criado_em: new Date(2026, 8, 12, 12).toISOString(), quantidade: 8, fragil: "não", produto_id: "A", empresa: "Atlas", local_lido: "02" },
  ];
  const result = computeReadingStats(readings, now);
  assert.equal(result.leituras_hoje, 1);
  assert.equal(result.serie_7d.at(-1).total, 1);
  assert.equal(result.quantidade_total, 20);
  assert.equal(result.produtos_distintos, 1);
  assert.equal(result.locais_distintos, 2);
  assert.equal(result.itens_frageis, 1);
});
