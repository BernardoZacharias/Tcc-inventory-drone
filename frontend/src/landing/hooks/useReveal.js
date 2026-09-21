import { useEffect } from "react";

/*
 * Revela os elementos de entrada conforme eles chegam na viewport.
 *
 * Usa IntersectionObserver de propósito: um listener de "scroll" dispara
 * a cada quadro e provoca reflow contínuo, derrubando o desempenho no
 * celular. O observer só avisa na transição.
 *
 * ──────────────────────────────────────────────────────────────────
 * POR QUE ELE OBSERVA O DOM, E NÃO SÓ A TROCA DE TELA
 *
 * A primeira versão consultava o DOM uma vez, na troca de página. Isso
 * funcionava enquanto todas as telas vinham no pacote inicial. Quando
 * elas passaram a ser carregadas sob demanda, a consulta virou uma
 * corrida perdida: no instante da troca a tela nova ainda não existe,
 * a busca não acha nada, e a função desistia — nem a rede de segurança
 * chegava a ser armada.
 *
 * O resultado era páginas inteiras invisíveis: o texto no DOM, com
 * `opacity: 0` e `blur`, esperando um observador que nunca veio.
 *
 * Agora o gatilho é o próprio DOM. Qualquer bloco que apareça depois —
 * tela preguiçosa, transição que atrasa a montagem, conteúdo que chega
 * da API — é adotado assim que entra na página.
 * ──────────────────────────────────────────────────────────────────
 */

const SELETOR = [
  ".reveal",
  ".reveal-esq",
  ".reveal-dir",
  ".reveal-zoom",
  ".escalonar",
].map((c) => `${c}:not(.is-in)`).join(", ");

/* Depois disto, o conteúdo aparece de qualquer jeito. */
const PRAZO_REDE_S = 2600;

export default function useReveal(chave) {
  useEffect(() => {
    const semMovimento = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;

    const temObserver = typeof IntersectionObserver !== "undefined";

    const revelar = (el) => el.classList.add("is-in");

    const obs = temObserver
      ? new IntersectionObserver(
          (entradas) => {
            for (const e of entradas) {
              if (e.isIntersecting) {
                revelar(e.target);
                obs.unobserve(e.target);
              }
            }
          },
          { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
        )
      : null;

    /* Já visível é revelado na hora: o observer só entrega durante as
       etapas de renderização, suspensas em aba de segundo plano. Quem
       abre a página assim veria o topo em branco até voltar para a aba. */
    const naTela = (el) => {
      const c = el.getBoundingClientRect();
      return c.top < window.innerHeight * 0.88 && c.bottom > 0;
    };

    let rede = null;

    const adotar = () => {
      const alvos = document.querySelectorAll(SELETOR);
      if (!alvos.length) return;

      for (const el of alvos) {
        if (semMovimento || !obs) {
          revelar(el);
        } else if (naTela(el)) {
          revelar(el);
        } else {
          obs.observe(el);
        }
      }

      /*
       * Rede de segurança: nada fica escondido para sempre.
       *
       * A revelação é enfeite; o conteúdo é o produto. Se o observer não
       * entregar — aba em segundo plano, navegador exótico, extensão
       * atrapalhando — o texto tem que aparecer assim mesmo. Um efeito
       * que falha e leva a página junto é pior que não ter efeito.
       */
      clearTimeout(rede);
      rede = setTimeout(() => {
        // `sem-espera` mostra na hora, sem transição: se chegamos
        // aqui, a animação já falhou uma vez — insistir nela seria
        // apostar de novo no que não funcionou.
        document.querySelectorAll(SELETOR).forEach((el) => {
          el.classList.add("sem-espera");
          revelar(el);
        });
      }, PRAZO_REDE_S);
    };

    adotar();

    /* O DOM é quem avisa. Só `childList`: mudar classe não dispara
       mutação de filhos, então adotar não realimenta o observador. */
    let agendado = false;
    const mo = new MutationObserver(() => {
      if (agendado) return;
      agendado = true;
      setTimeout(() => {
        agendado = false;
        adotar();
      }, 60);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(rede);
      mo.disconnect();
      obs?.disconnect();
    };
  }, [chave]);
}
