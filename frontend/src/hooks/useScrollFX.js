import { useEffect } from "react";

/*
 * useScrollFX — os efeitos que dependem da posição da rolagem.
 *
 * Dois efeitos, UM ouvinte:
 *
 *   progresso   quanto da página já foi lida, numa variável CSS
 *   paralaxe    elementos com [data-paralaxe] andam em ritmo próprio
 *
 * POR QUE UM OUVINTE SÓ: cada `scroll` dispara dezenas de vezes por
 * segundo. Dois ouvintes lendo `scrollY` e escrevendo estilo viram
 * leitura-escrita-leitura no mesmo quadro, e o navegador é obrigado a
 * recalcular layout no meio — é assim que rolagem engasga. Aqui tudo
 * é lido junto, agendado num rAF e escrito de uma vez.
 *
 * E só se escreve `transform` e variáveis CSS: nada que mexa em
 * layout. Trocar `top` por `transform` é a diferença entre 60 quadros
 * por segundo e uma rolagem tremida.
 */

export default function useScrollFX(chave) {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      document.documentElement.style.setProperty("--lido", "0");
      return undefined;
    }

    const raiz = document.documentElement;
    let pendente = false;
    let camadas = [...document.querySelectorAll("[data-paralaxe]")];

    const aplicar = () => {
      pendente = false;

      const altura = raiz.scrollHeight - window.innerHeight;
      const lido = altura > 0 ? Math.min(1, window.scrollY / altura) : 0;
      raiz.style.setProperty("--lido", lido.toFixed(4));

      const meio = window.innerHeight / 2;
      for (const el of camadas) {
        const caixa = el.getBoundingClientRect();
        // Distância do centro do elemento ao centro da tela, em telas.
        // Fora da viewport não se mexe: gastar transform no que
        // ninguém vê é desperdício puro.
        if (caixa.bottom < -200 || caixa.top > window.innerHeight + 200) continue;

        const centro = caixa.top + caixa.height / 2;
        const desvio = (centro - meio) / window.innerHeight;
        const forca = Number(el.dataset.paralaxe) || 20;
        el.style.setProperty("--pxy", `${(desvio * forca).toFixed(2)}px`);
      }
    };

    const aoRolar = () => {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(aplicar);
    };

    // A troca de tela muda quem está na página; sem reconsultar, a
    // paralaxe continuaria mexendo em elementos que já saíram.
    camadas = [...document.querySelectorAll("[data-paralaxe]")];
    aplicar();

    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);

    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, [chave]);
}
