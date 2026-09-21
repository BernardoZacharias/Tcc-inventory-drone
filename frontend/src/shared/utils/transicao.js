/*
 * transicao.js — para que lado a tela desliza.
 *
 * A regra vem da ordem das abas: clicar numa aba à direita empurra a
 * tela atual para a esquerda e traz a nova pela direita; clicar numa à
 * esquerda faz o contrário. O movimento conta de onde a pessoa veio,
 * em vez de ser sempre o mesmo esmaecer.
 *
 * Mora num módulo próprio porque é a parte que dá para errar em
 * silêncio: inverter um sinal não quebra nada, só deixa a navegação
 * com a sensação estranha de andar para trás quando se avança. Aqui
 * isso fica sob teste.
 */

export const ORDEM_DAS_ABAS = ["home", "about", "technology", "contact"];

/** px de deslocamento: o bastante para ler direção, sem jogar a página para fora. */
export const DESLIZE = 88;

/**
 * 1 avançando, -1 voltando, 0 quando não há deslize.
 *
 * Telas fora da navegação institucional (painel, leituras, relatórios)
 * devolvem 0: elas não formam uma sequência, e deslizar entre coisas
 * que não estão lado a lado sugere uma vizinhança que não existe.
 */
export function direcaoEntre(de, para) {
  const a = ORDEM_DAS_ABAS.indexOf(de);
  const b = ORDEM_DAS_ABAS.indexOf(para);
  if (a < 0 || b < 0 || a === b) return 0;
  return b > a ? 1 : -1;
}

export const transicaoDeTela = {
  entrar: (d) => ({
    // Avançando, a nova vem da direita; voltando, vem da esquerda.
    x: d === 0 ? 0 : d > 0 ? DESLIZE : -DESLIZE,
    opacity: 0,
  }),
  centro: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
  sair: (d) => ({
    // A que sai vai para o lado contrário ao de onde a nova entra.
    x: d === 0 ? 0 : d > 0 ? -DESLIZE : DESLIZE,
    opacity: 0,
    transition: { duration: 0.26, ease: [0.4, 0, 1, 1] },
  }),
};

/* ──────────────────────────────────────────────────────────────────
 * O PAINEL NÃO ANIMA
 *
 * Na landing a troca de tela é parte da apresentação: o deslize conta
 * de onde a pessoa veio, e o tempo faz parte do efeito.
 *
 * No painel o objetivo é oposto. Quem está trabalhando troca de tela
 * dezenas de vezes seguidas, e qualquer animação vira espera repetida.
 * Uma primeira tentativa foi encurtar a transição em vez de tirá-la; o
 * resultado continuou lento, porque o tempo não vinha da animação.
 *
 * Vinha do `mode="wait"` somado ao carregamento sob demanda: a tela
 * atual saía, o AnimatePresence segurava a entrada, e nesse intervalo
 * o chunk da tela nova ainda estava sendo buscado — com `fallback`
 * nulo, isso é tela em branco. A animação só dava nome ao que era
 * espera de rede.
 *
 * Então o painel deixou de animar, e o carregamento passou a ser
 * adiantado (ver `aquecerPainel` no App). Trocar de tela ali agora é
 * troca de conteúdo, não uma cena.
 * ────────────────────────────────────────────────────────────────── */

/** Só as telas institucionais animam a troca. */
const ANIMAM_TROCA = new Set(ORDEM_DAS_ABAS);

/**
 * A tela de destino participa de uma transição animada?
 *
 * A decisão é pelo DESTINO: é ele que entra, e é a entrada que a
 * pessoa percebe.
 */
export function deveAnimarTroca(pagina) {
  return ANIMAM_TROCA.has(pagina);
}
