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
    const alvos = document.querySelectorAll(".reveal:not(.is-in)");
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
    return () => obs.disconnect();
  }, [chave]);
}
