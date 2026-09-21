import { useEffect, useLayoutEffect, useRef } from "react";

/*
 * NavGoo — a gota que desce sob o item ativo da navegação.
 *
 * COMO O EFEITO LÍQUIDO FUNCIONA: um filtro SVG borra a camada inteira
 * e depois joga o contraste do canal alfa lá para cima. Formas
 * separadas, ao se aproximarem, têm suas bordas borradas sobrepostas —
 * e o contraste transforma esse encontro num contorno único. É por isso
 * que a gota parece se DESPRENDER da barra em vez de deslizar sobre ela.
 *
 * DUAS COISAS QUE O DESENHO EXIGE:
 *
 * 1. Só entra na camada filtrada o que pode ser borrado: o corpo da
 *    barra e a gota. Texto e ícone ficam FORA, por cima — passados pelo
 *    filtro, virariam manchas ilegíveis.
 *
 * 2. A gota desce, e não sobe. Numa barra no topo da página, subir a
 *    levaria para fora da tela; descendo, ela aponta para o conteúdo
 *    que o item abre.
 */

export default function NavGoo({ ativo, icone }) {
  const gotaRef = useRef(null);
  const iconeRef = useRef(null);
  const anteriorRef = useRef(null);

  /*
   * Posiciona a gota no centro do item ativo.
   *
   * A medição é feita no DOM, e não calculada a partir do índice: os
   * itens têm larguras diferentes ("Início" e "Sobre o sistema" não
   * medem o mesmo), então qualquer conta baseada em posição erraria.
   */
  useLayoutEffect(() => {
    const posicionar = () => {
      const gota = gotaRef.current;
      /*
       * A barra é encontrada subindo a partir do próprio elemento, e
       * não por uma ref vinda de fora.
       *
       * Isso não é preferência: os efeitos de layout do FILHO rodam
       * antes de o React anexar o ref do PAI, então uma ref recebida
       * por prop ainda estaria nula aqui — foi exatamente o que fez a
       * gota nascer invisível e encostada na borda esquerda.
       */
      const nav = gota?.closest(".navbar-nav");
      if (!nav || !gota) return;

      const alvo = nav.querySelector(`[data-nav="${ativo}"]`);
      if (!alvo) {
        gota.style.setProperty("opacity", "0");
        return;
      }

      const barra = nav.getBoundingClientRect();
      const item = alvo.getBoundingClientRect();
      const x = item.left - barra.left + item.width / 2;

      gota.style.setProperty("--x", `${x}px`);
      gota.style.setProperty("opacity", "1");
      if (iconeRef.current) {
        iconeRef.current.style.setProperty("--x", `${x}px`);
        iconeRef.current.style.setProperty("opacity", "1");
      }
    };

    posicionar();

    // A barra muda de largura quando a janela muda; sem isto a gota
    // ficaria apontando para o lugar errado depois de um resize.
    const ro = new ResizeObserver(posicionar);
    const nav = gotaRef.current?.closest(".navbar-nav");
    if (nav) ro.observe(nav);
    window.addEventListener("resize", posicionar);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", posicionar);
    };
  }, [ativo]);

  /*
   * O "derretimento": ao trocar de item, a gota se alonga na direção
   * do movimento e volta à forma ao chegar. É o que vende o líquido —
   * sem isso, ela só escorrega como um círculo rígido.
   */
  useEffect(() => {
    if (anteriorRef.current === null) {
      anteriorRef.current = ativo;
      return undefined;
    }
    if (anteriorRef.current === ativo) return undefined;
    anteriorRef.current = ativo;

    const gota = gotaRef.current;
    if (!gota) return undefined;

    gota.classList.add("derretendo");
    const t = setTimeout(() => gota.classList.remove("derretendo"), 420);
    return () => clearTimeout(t);
  }, [ativo]);

  return (
    <>
      <span className="nav-goo" aria-hidden="true">
        <span className="nav-goo__barra" />
        <span ref={gotaRef} className="nav-goo__gota" />
      </span>

      {/* O ícone viaja junto, mas por fora do filtro. A `key` força o
          remonte a cada troca, e é ela que reinicia a animação de
          entrada — sem isso, o ícone apareceria já pronto. */}
      <span ref={iconeRef} className="nav-goo__icone" aria-hidden="true" key={ativo}>
        {icone}
      </span>
    </>
  );
}

/*
 * O filtro em si, montado uma vez no topo da árvore.
 *
 * `stdDeviation` define quanto as formas "se procuram": pouco e elas
 * nunca se juntam, muito e a barra inteira vira mingau. A matriz de
 * cor mexe só no alfa — multiplica por 19 e subtrai 9 — o que joga o
 * meio-tom da borda borrada para opaco ou transparente, sem tocar no
 * RGB. Por isso o efeito funciona com qualquer cor do tema.
 */
export function FiltroGoo() {
  return (
    <svg className="nav-goo__def" aria-hidden="true" focusable="false">
      <defs>
        <filter id="gestock-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="borrado" />
          <feColorMatrix
            in="borrado"
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 19 -9"
            result="goo"
          />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </defs>
    </svg>
  );
}
