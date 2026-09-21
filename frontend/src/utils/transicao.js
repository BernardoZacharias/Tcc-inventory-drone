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
 * O PAINEL NÃO É A LANDING
 *
 * Na landing a troca de tela é parte da apresentação: o deslize conta
 * de onde a pessoa veio e o tempo generoso faz parte do efeito.
 *
 * No painel o objetivo é oposto. Quem está trabalhando troca de tela
 * dezenas de vezes seguidas, e cada animação vira espera repetida. Com
 * `mode="wait"`, o custo era somado: 0,26s para a atual sair MAIS
 * 0,42s para a nova entrar — quase 0,7s de tela vazia por clique.
 *
 * A troca aqui é curta e quase só uma dissolução, com uma subida de
 * poucos pixels que sinaliza "conteúdo novo" sem pedir atenção. Sair é
 * mais rápido que entrar, porque ninguém quer ver a tela antiga indo
 * embora — o que interessa é a que chega.
 * ────────────────────────────────────────────────────────────────── */

/** Subida discreta do painel: sinaliza troca sem virar movimento. */
export const SUBIDA_PAINEL = 6;

export const transicaoDePainel = {
  entrar: { opacity: 0, y: SUBIDA_PAINEL },
  centro: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
  },
  sair: {
    opacity: 0,
    // Sem deslocamento na saída: mover as duas telas em sequência
    // faria o conteúdo "pular" na troca, que é justamente o que o
    // painel não pode ter.
    transition: { duration: 0.09, ease: "linear" },
  },
};

/** Telas institucionais: as únicas que deslizam. */
const PAGINAS_DA_LANDING = new Set(ORDEM_DAS_ABAS);

/**
 * Qual conjunto de variantes a tela usa.
 *
 * A decisão é por tela de DESTINO: é ela que entra, e é a entrada que
 * a pessoa percebe.
 */
export function variantesPara(pagina) {
  return PAGINAS_DA_LANDING.has(pagina) ? transicaoDeTela : transicaoDePainel;
}
