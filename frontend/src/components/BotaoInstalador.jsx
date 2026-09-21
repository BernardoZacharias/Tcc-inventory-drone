import { Download } from "lucide-react";
import { INSTALADOR, detalheDoInstalador } from "../utils/instalador";
import "../styles/BotaoInstalador.css";

/*
 * BotaoInstalador — a chamada principal do site.
 *
 * É um <a>, e não um <button>: baixar é navegar até um arquivo. Com
 * link, o visitante ganha de graça o que o navegador já sabe fazer —
 * abrir em outra aba, copiar o endereço, retomar um download.
 *
 * O aviso embaixo não é enfeite. O instalador é de Windows e tem 84 MB;
 * quem está no celular ou no Mac precisa saber ANTES de clicar, não
 * depois de esperar o download de um arquivo que não vai executar.
 */
export default function BotaoInstalador({ variante = "primary", detalhe = true }) {
  return (
    <span className="baixar">
      <a
        className={`button ${variante} baixar__botao`}
        href={INSTALADOR.url}
        download={INSTALADOR.arquivo}
        aria-label={`Baixar Gestock Drone ${INSTALADOR.versao} para Windows`}
      >
        <span className="button-label">Baixar instalador</span>
        <span className="button-ico" aria-hidden="true">
          <Download size={15} strokeWidth={1.75} />
        </span>
      </a>

      {detalhe && (
        <small className="baixar__detalhe">{detalheDoInstalador()}</small>
      )}
    </span>
  );
}
