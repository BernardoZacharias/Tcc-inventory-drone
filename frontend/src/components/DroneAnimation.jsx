import { useRef } from "react";
import drone from "../assets/drone.png";

/*
 * DroneAnimation — o visual do topo da página inicial.
 *
 * ANTES ERA UM DRONE DESENHADO EM CSS: ~650 linhas de regras montando
 * braços, hélices e carenagem com gradientes fixos. Além de pesado, ele
 * não tinha como funcionar no tema claro — as cores estavam cravadas
 * para fundo escuro, e no tema branco a peça sumia.
 *
 * Agora é o drone de verdade, o mesmo da tela de acesso. Por ser um
 * drone BRANCO com alfa, ele se sustenta sobre fundo claro e escuro, o
 * que resolve o tema de graça.
 *
 * O resto da cena é montado com os tokens do sistema (`--accent`,
 * `--line`, `--surface-*`), então acompanha o tema em vez de brigar
 * com ele. Nada de cor fixa aqui — a única exceção é o vidro do visor,
 * que é sempre um pouco mais profundo que a página para o drone branco
 * ter contraste nos dois modos.
 */

export default function DroneAnimation() {
  const palcoRef = useRef(null);

  /* Paralaxe leve: o conjunto inclina na direção do ponteiro. Só
     transform, para a animação não custar layout. */
  function aoMover(evento) {
    const palco = palcoRef.current;
    if (!palco) return;

    const area = palco.getBoundingClientRect();
    const x = (evento.clientX - area.left) / area.width;
    const y = (evento.clientY - area.top) / area.height;

    palco.style.setProperty("--incl-x", `${((x - 0.5) * 7).toFixed(2)}deg`);
    palco.style.setProperty("--incl-y", `${((0.5 - y) * 5).toFixed(2)}deg`);
    palco.style.setProperty("--desl-x", `${((x - 0.5) * 18).toFixed(1)}px`);
    palco.style.setProperty("--desl-y", `${((y - 0.5) * 10).toFixed(1)}px`);
  }

  function aoSair() {
    const palco = palcoRef.current;
    if (!palco) return;
    for (const p of ["--incl-x", "--incl-y"]) palco.style.setProperty(p, "0deg");
    for (const p of ["--desl-x", "--desl-y"]) palco.style.setProperty(p, "0px");
  }

  return (
    <div
      ref={palcoRef}
      className="palco-drone"
      role="img"
      aria-label="Drone do Gestock lendo o QR Code de uma etiqueta de estoque"
      onPointerMove={aoMover}
      onPointerLeave={aoSair}
    >
      {/* Fundo: malha do galpão vista de cima, sumindo nas bordas */}
      <div className="palco-drone__malha" aria-hidden="true" />
      <div className="palco-drone__brilho" aria-hidden="true" />

      <div className="palco-drone__hud" aria-hidden="true">
        <span className="palco-drone__marca">
          <i /> Visão computacional
        </span>
        <span className="palco-drone__link">
          Link <b>99.8%</b>
        </span>
      </div>

      <div className="palco-drone__cena" aria-hidden="true">
        {/* Anéis de varredura, atrás do drone */}
        <span className="palco-drone__anel anel-1" />
        <span className="palco-drone__anel anel-2" />

        <div className="palco-drone__voo">
          <img className="palco-drone__aeronave" src={drone} alt="" />
        </div>

        {/*
          O feixe NÃO fica dentro do drone flutuante, e isso é
          deliberado: preso a ele, o comprimento vinha da altura da
          imagem e passava direto pela etiqueta, saindo pela borda de
          baixo do visor. Aqui o topo fica na câmera e a base trava no
          topo da etiqueta, que é como um gimbal estabilizado se
          comporta — o drone balança, a mira não sai do alvo.
        */}
        <span className="palco-drone__feixe" />
        <span className="palco-drone__poca" />

        {/* A etiqueta que está sendo lida */}
        <div className="palco-drone__etiqueta">
          <span className="palco-drone__mira" />
          <svg viewBox="0 0 21 21" className="palco-drone__qr" aria-hidden="true">
            {/* QR estilizado: três âncoras e alguns módulos. Desenhado,
                e não uma imagem, para herdar a cor do tema. */}
            <path d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0z" className="qr-anc" />
            <path d="M2 2h3v3H2zM16 2h3v3h-3zM2 16h3v3H2z" className="qr-mio" />
            <path d="M9 0h2v2H9zM9 4h2v3H9zM12 9h2v2h-2zM16 9h2v2h-2z
                     M9 9h2v2H9zM19 12h2v2h-2zM9 14h2v2H9zM12 16h2v2h-2z
                     M16 14h3v2h-3zM9 19h5v2H9zM16 19h3v2h-3z" className="qr-mod" />
          </svg>
          <span className="palco-drone__codigo">CX-4471</span>
        </div>
      </div>

      <div className="palco-drone__rodape" aria-hidden="true">
        <span className="palco-drone__estado">
          <i /> Rastreamento ativo
        </span>
        <span className="palco-drone__telemetria">2.8 m · 60 fps</span>
      </div>
    </div>
  );
}
