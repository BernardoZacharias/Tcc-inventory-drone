import { useEffect } from "react";

/*
 * Revela elementos .reveal conforme entram na viewport.
 *
 * Usa IntersectionObserver de proposito: um listener de "scroll"
 * dispara a cada quadro e provoca reflow continuo, derrubando o
 * desempenho no mobile. O observer so avisa na transicao.
 *
 * Reobserva a cada troca de pagina (a chave muda), porque o app
 * troca de tela sem desmontar a arvore inteira.
 */
export default function useReveal(chave) {
  useEffect(() => {
    // As variantes direcionais e a grade escalonada entram pelo mesmo
    // observer: um só, em vez de um por efeito.
    const alvos = document.querySelectorAll(
      ".reveal:not(.is-in), .reveal-esq:not(.is-in), .reveal-dir:not(.is-in), " +
      ".reveal-zoom:not(.is-in), .escalonar:not(.is-in)"
    );
    if (!alvos.length) return;

    // Sem suporte ou com movimento reduzido: mostra tudo direto.
    const semMovimento = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;

    if (semMovimento || typeof IntersectionObserver === "undefined") {
      alvos.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            obs.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );

    alvos.forEach((el) => obs.observe(el));

    /*
     * O que já está na tela é revelado NA HORA, sem esperar o observer.
     *
     * O IntersectionObserver só entrega durante as etapas de renderização
     * do navegador, e elas são suspensas em aba oculta ou em segundo
     * plano. Quem abre a página nessa condição veria o conteúdo do topo
     * em branco até voltar para a aba.
     */
    const naTela = (el) => {
      const c = el.getBoundingClientRect();
      return c.top < window.innerHeight * 0.88 && c.bottom > 0;
    };
    alvos.forEach((el) => {
      if (naTela(el)) {
        el.classList.add("is-in");
        obs.unobserve(el);
      }
    });

    /*
     * Rede de segurança: nada fica escondido para sempre.
     *
     * A revelação é um enfeite; o conteúdo é o produto. Se o observer
     * não entregar — aba em segundo plano, navegador exótico, extensão
     * atrapalhando — o texto tem que aparecer assim mesmo. Um efeito
     * que falha e leva a página junto é pior que não ter efeito.
     */
    const salvaVidas = setTimeout(() => {
      alvos.forEach((el) => el.classList.add("is-in"));
    }, 2600);

    return () => {
      clearTimeout(salvaVidas);
      obs.disconnect();
    };
  }, [chave]);
}
