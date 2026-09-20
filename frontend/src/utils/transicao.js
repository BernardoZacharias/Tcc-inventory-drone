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
