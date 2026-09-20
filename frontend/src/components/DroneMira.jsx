import { memo } from "react";

/*
 * DroneMira — a mira que trava no QR Code.
 *
 * REGRA QUE DEFINE O DESENHO: nada é pintado em cima do código. O
 * leitor precisa daqueles pixels, e o operador precisa enxergar a
 * etiqueta para julgar se está limpa, torta ou rasgada. Então a mira
 * CONTORNA — os cantos ficam para fora do polígono, com folga.
 *
 * As coordenadas chegam do Agent no sistema do quadro original. Aqui
 * elas não são convertidas para pixels de tela: o <svg> recebe um
 * viewBox do tamanho do quadro e o CSS faz o resto. É o que mantém a
 * mira grudada no código quando a janela muda de tamanho, sem ouvinte
 * de resize e sem recalcular nada.
 */

/* Quanto o contorno se afasta do código, em fração do lado. */
const FOLGA = 0.07;
/* Tamanho do canto, em fração do lado. */
const CANTO = 0.24;

function caixa(pontos) {
  const xs = pontos.map((p) => p[0]);
  const ys = pontos.map((p) => p[1]);
  return {
    x0: Math.min(...xs), y0: Math.min(...ys),
    x1: Math.max(...xs), y1: Math.max(...ys),
  };
}

function Alvo({ alvo }) {
  if (!alvo.pontos || alvo.pontos.length < 3) return null;

  const { x0, y0, x1, y1 } = caixa(alvo.pontos);
  const lado = Math.max(x1 - x0, y1 - y0);
  const folga = Math.max(6, lado * FOLGA);

  const a = x0 - folga;
  const b = y0 - folga;
  const c = x1 + folga;
  const d = y1 + folga;
  const canto = Math.max(10, lado * CANTO);

  // Quatro "L" nos cantos. Traços abertos, para o meio ficar livre.
  const cantos = [
    `M ${a} ${b + canto} L ${a} ${b} L ${a + canto} ${b}`,
    `M ${c - canto} ${b} L ${c} ${b} L ${c} ${b + canto}`,
    `M ${c} ${d - canto} L ${c} ${d} L ${c - canto} ${d}`,
    `M ${a + canto} ${d} L ${a} ${d} L ${a} ${d - canto}`,
  ];

  const classe = alvo.registrado ? "dm-alvo registrado" : "dm-alvo";

  return (
    <g className={classe}>
      {/* Contorno inteiro, bem fino: mostra o enquadramento exato sem
          disputar atenção com os cantos. */}
      <rect className="dm-contorno" x={a} y={b} width={c - a} height={d - b} />

      {cantos.map((traco, i) => (
        <path key={i} className="dm-canto" d={traco} />
      ))}

      {/* O rótulo fica FORA da caixa: em cima do código, nunca. */}
      <text className="dm-rotulo" x={a} y={b - folga * 0.6}>
        {alvo.registrado ? "REGISTRADO" : "LENDO"}
      </text>
    </g>
  );
}

/* Mira de repouso: o sistema procurando, sem nada travado ainda. */
function Procurando({ largura, altura }) {
  const cx = largura / 2;
  const cy = altura / 2;
  const r = Math.min(largura, altura) * 0.17;
  const risco = r * 0.45;

  return (
    <g className="dm-procurando" aria-hidden="true">
      <circle className="dm-anel" cx={cx} cy={cy} r={r} />
      <path
        className="dm-cruz"
        d={`M ${cx - r - risco} ${cy} H ${cx - r * 0.55}
            M ${cx + r * 0.55} ${cy} H ${cx + r + risco}
            M ${cx} ${cy - r - risco} V ${cy - r * 0.55}
            M ${cx} ${cy + r * 0.55} V ${cy + r + risco}`}
      />
    </g>
  );
}

function DroneMira({ alvos, largura, altura, procurando }) {
  if (!largura || !altura) return null;

  return (
    <svg
      className="dm-camada"
      viewBox={`0 0 ${largura} ${altura}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {procurando && alvos.length === 0 && (
        <Procurando largura={largura} altura={altura} />
      )}
      {alvos.map((alvo, i) => (
        <Alvo key={`${alvo.codigo}-${i}`} alvo={alvo} />
      ))}
    </svg>
  );
}

export default memo(DroneMira);
