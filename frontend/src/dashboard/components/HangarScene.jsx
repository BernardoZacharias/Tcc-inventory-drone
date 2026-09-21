import { memo } from "react";
import hangar from "../assets/hangar.jpg";
import drone from "../assets/drone.png";

/*
 * HangarScene — o drone trabalhando dentro do galpão.
 *
 * Não é foto de banco de imagem nem enfeite: é a cena que o produto
 * executa. Corredor real ao fundo, o drone pairando no meio dele, o
 * feixe varrendo a prateleira e as etiquetas travando no item lido.
 *
 * Montado em camadas no DOM, e não como imagem única, para que o drone
 * paire de verdade e o HUD pulse. Tudo anima só transform/opacity.
 */

/* Leituras de exemplo. Valores "sujos" de propósito: 24, 7, 132 parecem
   inventário real; 100, 50, 10 pareceriam placeholder. */
const LEITURAS = [
  { id: 1, codigo: "CX-4471", info: "24 un · Corredor A-03", topo: "22%", esq: "7%",  atraso: "0s" },
  { id: 2, codigo: "CX-4488", info: "7 un · frágil",         topo: "41%", esq: "15%", atraso: "2.6s" },
  { id: 3, codigo: "PL-1132", info: "132 un · pallet",       topo: "57%", esq: "9%",  atraso: "5.2s" },
];

/* Cores FIXAS sobre a cena.
   A foto do galpão é sempre escura — ela não acompanha o tema, porque
   é uma imagem tratada e não uma superfície do sistema. Se o texto por
   cima usar os tokens que invertem, no tema claro ele vira quase preto
   sobre a foto escura e some. Aqui a cor é do ambiente, não do tema. */
function HangarScene() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050506]">
      {/* ── Corredor ── */}
      <img
        src={hangar}
        alt=""
        aria-hidden="true"
        className="absolute inset-y-0 left-[-34%] h-full w-[128%] max-w-none object-cover object-center"
      />

      {/* Escurece o pé da imagem e a borda que encosta no formulário,
          para o texto ler e a emenda entre os dois lados sumir. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_top,#050506_2%,transparent_45%),linear-gradient(to_right,transparent_55%,#050506)]"
      />

      {/* ── O drone ── */}
      <div
        aria-hidden="true"
        className="absolute left-[47%] top-[34%] w-[31%] -translate-x-1/2
                   motion-safe:animate-[pairar_7s_ease-in-out_infinite]"
      >
        <img
          src={drone}
          alt=""
          className="w-full drop-shadow-[0_28px_40px_rgba(0,0,0,0.75)]"
        />

        {/* Feixe saindo da câmera do drone em direção à prateleira */}
        <div
          className="absolute left-[36%] top-[80%] h-[26vh] w-[34%] origin-top
                     -rotate-[26deg] opacity-55 blur-[2px]
                     [background:linear-gradient(to_bottom,#22d3ee,transparent_78%)]
                     [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]
                     motion-safe:animate-[feixe_3.4s_ease-in-out_infinite]"
        />
      </div>

      {/* Sombra do drone no piso */}
      <div
        aria-hidden="true"
        className="absolute left-[45%] top-[74%] h-2.5 w-[16%] -translate-x-1/2 rounded-[50%]
                   bg-[radial-gradient(ellipse,rgba(0,0,0,0.8),transparent_72%)]
                   motion-safe:animate-[sombra_7s_ease-in-out_infinite]"
      />

      {/* ── HUD: o que o drone está lendo agora ── */}
      {LEITURAS.map((l) => (
        <div
          key={l.id}
          aria-hidden="true"
          style={{ top: l.topo, left: l.esq, animationDelay: l.atraso }}
          className="absolute flex items-center gap-2.5 rounded-sm border border-[#22d3ee55]
                     bg-[rgba(5,7,12,0.72)] px-2.5 py-1.5
                     opacity-0 backdrop-blur-sm
                     motion-safe:animate-[travar_7.8s_ease-in-out_infinite]
                     motion-reduce:opacity-100"
        >
          {/* Mira de canto, como visor de câmera */}
          <span className="relative block size-3.5 shrink-0">
            <span className="absolute left-0 top-0 size-1.5 border-l border-t border-[#22d3ee]" />
            <span className="absolute right-0 top-0 size-1.5 border-r border-t border-[#22d3ee]" />
            <span className="absolute bottom-0 left-0 size-1.5 border-b border-l border-[#22d3ee]" />
            <span className="absolute bottom-0 right-0 size-1.5 border-b border-r border-[#22d3ee]" />
          </span>

          <span className="font-mono text-[11px] font-medium tabular-nums text-[#22d3ee]">
            {l.codigo}
          </span>
          <span className="text-[11px] text-white/65">{l.info}</span>
        </div>
      ))}
    </div>
  );
}

export default memo(HangarScene);
