import { useEffect, useRef, useState } from "react";
import "../styles/CursorDrone.css";

/*
 * CursorDrone
 * ───────────
 * Um quadricóptero que acompanha o ponteiro pelo site inteiro.
 *
 * Não é um "seguidor" ingênuo que cola no cursor: ele voa até lá.
 * A posição é integrada com mola + amortecimento, e a atitude do
 * drone é derivada da VELOCIDADE resultante — que é como um
 * quadricóptero real se comporta:
 *
 *   • para ir para a direita, ele ROLA para a direita (banking)
 *   • para acelerar à frente, ele ARFA para baixo (pitch)
 *   • ao frear, a inclinação se inverte antes de estabilizar
 *   • parado, mantém pairagem com micro-oscilação (hover drift)
 *
 * O gimbal da câmera compensa a inclinação do corpo, exatamente como
 * um gimbal físico faz para manter a lente estável.
 *
 * Ao passar sobre algo clicável, o drone desce um pouco, acende o
 * feixe e trava a mira no alvo.
 */

/* ── Constantes de voo ───────────────────────────────────────── */
const RIGIDEZ = 0.055;   // o quanto ele "puxa" na direção do alvo
const AMORT = 0.86;      // amortecimento (1 = sem atrito)
const OFFSET_X = 46;     // fica ao lado do cursor, não em cima
const OFFSET_Y = -38;
const MAX_ROLL = 26;     // graus
const MAX_PITCH = 16;
const PARADO = 0.05;     // limiar de velocidade para considerar pairando

const CLICAVEL = 'a, button, [role="button"], input, select, textarea, label, summary';

export default function CursorDrone() {
  const wrapRef = useRef(null);
  const corpoRef = useRef(null);
  const gimbalRef = useRef(null);
  const sombraRef = useRef(null);

  const [ativo, setAtivo] = useState(false);
  const [travado, setTravado] = useState(false);

  // Estado físico fora do React: nada disso deve causar re-render
  const fis = useRef({
    x: -200, y: -200,      // posição atual do drone
    vx: 0, vy: 0,          // velocidade
    alvoX: -200, alvoY: -200,
    t: 0,                  // relógio para a pairagem
    visto: false
  });

  useEffect(() => {
    // Só faz sentido com mouse de verdade: pula em toque e quando o
    // usuário pediu menos movimento.
    const temMouse = window.matchMedia("(pointer: fine)").matches;
    const menosMovimento = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!temMouse || menosMovimento) return;

    const f = fis.current;

    function onMove(e) {
      f.alvoX = e.clientX + OFFSET_X;
      f.alvoY = e.clientY + OFFSET_Y;

      if (!f.visto) {
        // Primeira aparição: nasce já perto, sem voar da esquina
        f.visto = true;
        f.x = f.alvoX - 90;
        f.y = f.alvoY - 60;
        setAtivo(true);
      }

      const alvo = e.target?.closest?.(CLICAVEL);
      setTravado(Boolean(alvo));
    }

    function onLeave() { setAtivo(false); }
    function onEnter() { if (f.visto) setAtivo(true); }

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);

    let raf;
    function quadro() {
      f.t += 0.016;

      // ── Integração mola-amortecedor ──
      f.vx = (f.vx + (f.alvoX - f.x) * RIGIDEZ) * AMORT;
      f.vy = (f.vy + (f.alvoY - f.y) * RIGIDEZ) * AMORT;
      f.x += f.vx;
      f.y += f.vy;

      const parado = Math.hypot(f.vx, f.vy) < PARADO;

      // Pairagem: respiração vertical só quando praticamente parado
      const drift = parado ? Math.sin(f.t * 1.9) * 3.2 : 0;
      const driftLat = parado ? Math.cos(f.t * 1.3) * 1.4 : 0;

      // ── Atitude derivada da velocidade ──
      const roll = Math.max(-MAX_ROLL, Math.min(MAX_ROLL, -f.vx * 1.5));
      const pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, f.vy * 0.9));

      if (wrapRef.current) {
        wrapRef.current.style.transform =
          `translate3d(${(f.x + driftLat).toFixed(2)}px, ${(f.y + drift).toFixed(2)}px, 0)`;
      }
      if (corpoRef.current) {
        // rotateX simula a arfagem; scaleY comprime a silhueta como
        // aconteceria de fato ao inclinar para longe da câmera
        corpoRef.current.style.transform =
          `rotate(${roll.toFixed(2)}deg) scaleY(${(1 - Math.abs(pitch) / 90).toFixed(3)})`;
      }
      if (gimbalRef.current) {
        // O gimbal cancela o giro do corpo: a lente fica estável
        gimbalRef.current.style.transform = `rotate(${(-roll * 0.85).toFixed(2)}deg)`;
      }
      if (sombraRef.current) {
        // Sombra encolhe quando o drone "sobe" na pairagem
        const s = 1 - Math.abs(drift) / 26;
        sombraRef.current.style.transform = `scale(${s.toFixed(3)})`;
        sombraRef.current.style.opacity = (0.30 * s).toFixed(3);
      }

      raf = requestAnimationFrame(quadro);
    }
    raf = requestAnimationFrame(quadro);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`cursor-drone${ativo ? " is-on" : ""}${travado ? " is-locked" : ""}`}
      aria-hidden="true"
    >
      {/* Sombra projetada no "chão" */}
      <span ref={sombraRef} className="cd-shadow" />

      {/* Feixe do scanner — só acende sobre algo clicável */}
      <span className="cd-beam" />

      <div ref={corpoRef} className="cd-body">
        <svg viewBox="0 0 220 150" width="112" height="76" className="cd-svg">
          <defs>
            {/* Fuselagem em fibra de carbono */}
            <linearGradient id="cdFuse" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#3d4450" />
              <stop offset="42%"  stopColor="#20242c" />
              <stop offset="100%" stopColor="#0e1116" />
            </linearGradient>
            {/* Braços: alumínio escovado */}
            <linearGradient id="cdArm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#525a67" />
              <stop offset="55%"  stopColor="#2b3038" />
              <stop offset="100%" stopColor="#161a20" />
            </linearGradient>
            {/* Disco de hélice em movimento */}
            <radialGradient id="cdProp" cx="50%" cy="50%" r="50%">
              <stop offset="30%"  stopColor="currentColor" stopOpacity="0.05" />
              <stop offset="72%"  stopColor="currentColor" stopOpacity="0.20" />
              <stop offset="94%"  stopColor="currentColor" stopOpacity="0.42" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
            {/* Brilho da lente */}
            <radialGradient id="cdLens" cx="36%" cy="30%" r="72%">
              <stop offset="0%"   stopColor="#9fe8ff" />
              <stop offset="45%"  stopColor="#1b6c86" />
              <stop offset="100%" stopColor="#05121a" />
            </radialGradient>
          </defs>

          {/* ── Braços ── */}
          <g stroke="url(#cdArm)" strokeWidth="11" strokeLinecap="round">
            <line x1="110" y1="76" x2="46"  y2="44" />
            <line x1="110" y1="76" x2="174" y2="44" />
            <line x1="110" y1="76" x2="46"  y2="104" />
            <line x1="110" y1="76" x2="174" y2="104" />
          </g>
          {/* Filete de luz no topo dos braços */}
          <g stroke="#6c7787" strokeWidth="1.6" strokeLinecap="round" opacity="0.85">
            <line x1="108" y1="72" x2="48"  y2="41" />
            <line x1="112" y1="72" x2="172" y2="41" />
          </g>

          {/* ── Rotores ── */}
          {[
            { x: 46,  y: 44,  cw: true  },
            { x: 174, y: 44,  cw: false },
            { x: 46,  y: 104, cw: false },
            { x: 174, y: 104, cw: true  }
          ].map((m, i) => (
            <g key={i}>
              {/* motor */}
              <ellipse cx={m.x} cy={m.y} rx="10" ry="7.5" fill="#1b2027" />
              <ellipse cx={m.x} cy={m.y - 2} rx="8" ry="5.6" fill="#3a424e" />
              <ellipse cx={m.x} cy={m.y - 3} rx="4" ry="2.6" fill="#5d6775" />
              {/* disco da hélice girando */}
              <g className={`cd-prop ${m.cw ? "cw" : "ccw"}`} style={{ transformOrigin: `${m.x}px ${m.y - 4}px` }}>
                <ellipse cx={m.x} cy={m.y - 4} rx="40" ry="11" fill="url(#cdProp)" />
                <ellipse cx={m.x} cy={m.y - 4} rx="40" ry="2.2" fill="currentColor" opacity="0.30" />
              </g>
            </g>
          ))}

          {/* ── Fuselagem ── */}
          <path
            d="M74 50 Q110 40 146 50 L156 76 Q110 96 64 76 Z"
            fill="url(#cdFuse)" stroke="#080a0d" strokeWidth="1.6"
          />
          {/* reflexo superior */}
          <path d="M80 52 Q110 45 140 52 L136 60 Q110 55 84 60 Z" fill="#ffffff" opacity="0.07" />

          {/* Luzes de navegação: verde à frente, vermelha atrás */}
          <circle cx="110" cy="45" r="3.4" className="cd-nav-front" />
          <circle cx="86"  cy="86" r="2.6" className="cd-nav-rear" />
          <circle cx="134" cy="86" r="2.6" className="cd-nav-rear" />

          {/* ── Gimbal + câmera ── */}
          <g ref={gimbalRef} style={{ transformOrigin: "110px 80px" }}>
            <path d="M100 82 h20 v9 a10 10 0 0 1 -20 0 Z" fill="#20252d" stroke="#0a0d11" strokeWidth="1.2" />
            <circle cx="110" cy="90" r="7.5" fill="url(#cdLens)" stroke="#0a0d11" strokeWidth="1.4" />
            <circle cx="110" cy="90" r="3" fill="#04222e" />
            <circle cx="107.6" cy="87.6" r="1.5" fill="#dff6ff" opacity="0.9" />
          </g>

          {/* Trem de pouso */}
          <g stroke="#2a3038" strokeWidth="3" strokeLinecap="round">
            <line x1="88"  y1="84" x2="80"  y2="100" />
            <line x1="132" y1="84" x2="140" y2="100" />
          </g>
        </svg>
      </div>

      {/* Retículo de mira — aparece travado no alvo */}
      <span className="cd-reticle">
        <span /><span /><span /><span />
      </span>
    </div>
  );
}
