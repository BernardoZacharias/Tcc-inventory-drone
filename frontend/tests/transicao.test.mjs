import test from "node:test";
import assert from "node:assert/strict";
import {
  direcaoEntre, transicaoDeTela, DESLIZE,
  variantesPara, transicaoDePainel, SUBIDA_PAINEL,
} from "../src/utils/transicao.js";

/*
 * A direção do deslize é a parte que dá para errar em silêncio: um
 * sinal invertido não quebra nada, só deixa a navegação com a sensação
 * de andar para trás quando se avança. Estes testes fixam o
 * comportamento pedido, com o exemplo que o descreve.
 */

test("avançar nas abas empurra a tela para a esquerda", () => {
  assert.equal(direcaoEntre("home", "about"), 1);
  assert.equal(direcaoEntre("home", "contact"), 1);
  assert.equal(direcaoEntre("about", "technology"), 1);
});

test("voltar nas abas empurra a tela para a direita", () => {
  assert.equal(direcaoEntre("about", "home"), -1);
  assert.equal(direcaoEntre("contact", "technology"), -1);
});

test("de 'Sobre o sistema' para 'Início': sai pela direita, entra pela esquerda", () => {
  // O caso exato que descreve o efeito: a tela atual vai para a
  // direita e puxa a de início vindo da esquerda.
  const d = direcaoEntre("about", "home");
  assert.equal(d, -1);

  const sai = transicaoDeTela.sair(d);
  const entra = transicaoDeTela.entrar(d);

  assert.ok(sai.x > 0, `a tela atual deveria sair para a direita, foi para ${sai.x}`);
  assert.ok(entra.x < 0, `a nova deveria vir da esquerda, veio de ${entra.x}`);
  assert.equal(sai.x, DESLIZE);
  assert.equal(entra.x, -DESLIZE);
});

test("de 'Início' para 'Tecnologia': sai pela esquerda, entra pela direita", () => {
  const d = direcaoEntre("home", "technology");
  assert.equal(d, 1);
  assert.ok(transicaoDeTela.sair(d).x < 0);
  assert.ok(transicaoDeTela.entrar(d).x > 0);
});

test("a que sai e a que entra vão para lados opostos", () => {
  for (const d of [1, -1]) {
    const sai = transicaoDeTela.sair(d).x;
    const entra = transicaoDeTela.entrar(d).x;
    assert.ok(sai * entra < 0, `em ${d}, sai=${sai} e entra=${entra} apontam para o mesmo lado`);
  }
});

test("telas fora da navegação institucional não deslizam", () => {
  // O painel e as telas de trabalho não formam uma sequência; deslizar
  // entre elas sugeriria uma vizinhança que não existe.
  assert.equal(direcaoEntre("dashboard", "readings"), 0);
  assert.equal(direcaoEntre("home", "dashboard"), 0);
  assert.equal(direcaoEntre("login", "home"), 0);
  assert.equal(transicaoDeTela.entrar(0).x, 0);
  assert.equal(transicaoDeTela.sair(0).x, 0);
});

test("ficar na mesma aba não move nada", () => {
  assert.equal(direcaoEntre("about", "about"), 0);
});

test("a tela sai mais rápido do que a próxima entra", () => {
  // Sair depressa e entrar com calma é o que faz a troca parecer
  // conduzida, e não um corte seco.
  assert.ok(transicaoDeTela.sair(1).transition.duration
            < transicaoDeTela.centro.transition.duration);
});

/*
 * O painel não é a landing.
 *
 * Aqui o risco é o inverso do deslize: nada quebra se o painel herdar
 * a animação longa da landing — ele só fica lento, e lentidão é o tipo
 * de defeito que a gente se acostuma a ignorar. Os testes prendem a
 * separação.
 */

test("as telas da landing continuam com o deslize", () => {
  for (const tela of ["home", "about", "technology", "contact"]) {
    assert.equal(variantesPara(tela), transicaoDeTela);
  }
});

test("as telas de trabalho usam a transição do painel", () => {
  for (const tela of ["dashboard", "readings", "reports", "operations",
                      "companies", "alerts", "drones", "operators",
                      "reading", "company", "login"]) {
    assert.equal(variantesPara(tela), transicaoDePainel);
  }
});

test("o painel não desliza para os lados", () => {
  // Deslocamento horizontal no painel sugeriria uma vizinhança entre
  // telas que não existe: relatórios não fica "à direita" de alertas.
  assert.equal(transicaoDePainel.entrar.x, undefined);
  assert.equal(transicaoDePainel.sair.x, undefined);
  assert.equal(transicaoDePainel.entrar.y, SUBIDA_PAINEL);
  assert.equal(transicaoDePainel.centro.y, 0);
});

test("a troca no painel é bem mais curta que a da landing", () => {
  const painel = transicaoDePainel.centro.transition.duration
               + transicaoDePainel.sair.transition.duration;
  const landing = transicaoDeTela.centro.transition.duration
                + transicaoDeTela.sair(1).transition.duration;

  // Com mode="wait" os dois tempos se somam a cada clique.
  assert.ok(painel < landing / 2,
    `painel (${painel}s) deveria ser bem menor que landing (${landing}s)`);
  assert.ok(painel <= 0.3, `painel demorando ${painel}s`);
});

test("a saída do painel é mais rápida que a entrada", () => {
  // O que interessa é a tela que chega, não a que vai embora.
  assert.ok(transicaoDePainel.sair.transition.duration
          < transicaoDePainel.centro.transition.duration);
});
