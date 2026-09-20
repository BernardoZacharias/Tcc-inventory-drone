import { useEffect, useState } from "react";
import DroneCockpit from "../src/components/DroneCockpit";

/*
 * CockpitPreview — mostra a tela de voo fora do Electron.
 *
 * O cockpit normalmente é alimentado pelo useDroneAgent, que só existe
 * dentro do aplicativo. Aqui a gente fala direto com o servidor local
 * do Agent, então dá para revisar a tela — com vídeo de verdade — sem
 * empacotar nada:
 *
 *     cd gestock-drone-agent
 *     .venv\\Scripts\\python -m src.main --driver synthetic --qr --servidor
 *
 * A porta pode vir pela URL: ?porta=8766
 */

const PADRAO = 8765;

export default function CockpitPreview() {
  const porta = Number(
    new URLSearchParams(window.location.search).get("porta") || PADRAO
  );

  const [estado, setEstado] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;

    const ler = async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${porta}/estado`, {
          cache: "no-store",
        });
        const dados = await r.json();
        if (!cancelado) { setEstado(dados); setErro(""); }
      } catch {
        if (!cancelado) {
          setErro(
            `Nenhum Agent respondendo em 127.0.0.1:${porta}. Rode: ` +
            "python -m src.main --driver synthetic --qr --servidor"
          );
        }
      }
    };

    ler();
    const id = setInterval(ler, 700);
    return () => { cancelado = true; clearInterval(id); };
  }, [porta]);

  // Espelha o que o useDroneAgent entrega, inclusive a troca de vista.
  const [vista, setVista] = useState("ORIGINAL");

  const agente = {
    urlVideo: `http://127.0.0.1:${porta}/video?vista=${encodeURIComponent(vista)}`,
    estado,
    leituras: estado?.leituras || [],
    metricas: estado?.metricas || {},
    registro: estado?.registro || {},
    vista,
    vistas: estado?.vistas || [],
    trocarVista: setVista,
    erro,
    log: [],
  };

  return <DroneCockpit agente={agente} onFechar={() => {}} empresaNome="Atlas Logística" />;
}
