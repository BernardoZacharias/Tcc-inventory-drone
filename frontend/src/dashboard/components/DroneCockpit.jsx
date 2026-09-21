import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Radio, Wifi, WifiOff, Package, AlertTriangle,
  MapPin, Crosshair, Gauge, Layers, Loader2, Timer,
  Volume2, VolumeX, Check, CloudOff
} from "lucide-react";
import DroneMira from "./DroneMira";
import { beepLeituraNova } from "../utils/beep";
import "../styles/DroneCockpit.css";

/*
 * DroneCockpit — a tela de voo: o que a câmera do drone está vendo,
 * em tela cheia, com o que foi lido aparecendo por cima.
 *
 * O vídeo é um <img> apontando para o servidor local do Agent, que
 * serve MJPEG. Parece improvisado e não é: o navegador decodifica
 * MJPEG nativamente, sem codec, sem player e sem passar vídeo por IPC.
 * Trocar por <video> exigiria empacotar em fMP4 ou HLS para ganhar
 * nada — a latência aqui já é de um quadro.
 *
 * A tela é escura de propósito e NÃO acompanha o tema claro. O assunto
 * é uma imagem de câmera: fundo claro em volta de vídeo cansa a vista
 * e falseia as cores do que está sendo inspecionado.
 *
 * O VÍDEO E A MIRA DIVIDEM UMA CAIXA DO TAMANHO DO VISOR, e cada um
 * se encaixa nela pela mesma regra — `object-fit: contain` na imagem,
 * `preserveAspectRatio` padrão no SVG. Como a regra é a mesma, os dois
 * caem no mesmo retângulo e a mira fica colada no código sem ninguém
 * medir nada.
 */

const ESTADOS_OK = new Set(["STREAM_ATIVO", "LEITURA_ATIVA"]);

/* "1 leituras" numa tela de produto é desleixo que se nota. */
const plural = (n, singular, plural_) => (n === 1 ? singular : plural_);

/*
 * Onde as leituras desta sessão foram parar.
 *
 * Na Wi-Fi do drone não há internet, então ficar com leituras pendentes
 * é o estado NORMAL do voo, não uma falha. O texto precisa dizer isso —
 * um alerta vermelho aqui treinaria o operador a ignorar alertas.
 */
function Registro({ registro }) {
  const { pendentes = 0, enviadas = 0, total = 0, erro_envio: erroEnvio } = registro || {};

  if (!total) {
    return (
      <footer className="dc-registro">
        As leituras são gravadas no computador assim que acontecem, e
        sobem para o estoque quando houver internet.
      </footer>
    );
  }

  if (!pendentes) {
    return (
      <footer className="dc-registro ok">
        <Check size={13} strokeWidth={2.5} aria-hidden="true" />
        <span>
          {enviadas} {plural(enviadas, "leitura registrada", "leituras registradas")} no estoque
        </span>
      </footer>
    );
  }

  return (
    <footer className="dc-registro aguardando">
      <CloudOff size={13} strokeWidth={2} aria-hidden="true" />
      <span>
        <strong>{pendentes}</strong> {plural(pendentes, "leitura salva", "leituras salvas")} no
        computador, {plural(pendentes, "aguardando", "aguardando")} internet para subir ao estoque.
        {enviadas > 0 && ` ${enviadas} já ${plural(enviadas, "subiu", "subiram")}.`}
        {erroEnvio && <em title={erroEnvio}> Nada foi perdido.</em>}
      </span>
    </footer>
  );
}

function Metrica({ icone: Icone, valor, rotulo, destaque = false }) {
  return (
    <div className={`dc-metrica${destaque ? " destaque" : ""}`}>
      <Icone size={14} strokeWidth={1.75} aria-hidden="true" />
      <strong>{valor}</strong>
      <span>{rotulo}</span>
    </div>
  );
}

export default function DroneCockpit({ agente, onFechar, empresaNome }) {
  const {
    urlVideo, estado, leituras, metricas, erro, log,
    vista, vistas, trocarVista, registro,
  } = agente;

  // O <img> do MJPEG só dispara onLoad quando o PRIMEIRO quadro chega.
  // Antes disso a tela fica preta, e é aí que o usuário acha que travou.
  const [temVideo, setTemVideo] = useState(false);
  const [semQuadros, setSemQuadros] = useState(false);

  // Stream novo zera a espera. Ajustar durante a renderização é o
  // padrão do React para isto — por efeito, a tela chegaria a pintar
  // um quadro com o estado do stream anterior.
  const [urlAnterior, setUrlAnterior] = useState(urlVideo);
  if (urlVideo !== urlAnterior) {
    setUrlAnterior(urlVideo);
    setTemVideo(false);
    setSemQuadros(false);
  }

  // Se o primeiro quadro não chega, é porque não vai chegar: quase
  // sempre o notebook saiu da Wi-Fi do drone. Melhor dizer isso do que
  // deixar girando para sempre.
  useEffect(() => {
    if (!urlVideo || temVideo) return undefined;
    const id = setTimeout(() => setSemQuadros(true), 12000);
    return () => clearTimeout(id);
  }, [urlVideo, temVideo]);

  // ESC fecha, como em qualquer tela cheia.
  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  /*
   * O aviso de leitura: som e animação.
   *
   * O operador está olhando para a PRATELEIRA, não para a tela — ele
   * precisa saber que leu sem desviar os olhos. Por isso o som vem
   * primeiro e a animação é grande.
   *
   * A leitura nova é detectada durante a renderização (padrão do React
   * para reagir a dado que mudou) e o som toca no efeito, porque tocar
   * som é falar com um sistema externo, não calcular tela.
   */
  const [somLigado, setSomLigado] = useState(true);

  // O ref existe para o efeito do anuncio ler o som SEM depender dele:
  // com `somLigado` nas dependencias, desligar o som no meio de um
  // anuncio faria o efeito rodar de novo e bipar outra vez.
  const somRef = useRef(true);
  useEffect(() => { somRef.current = somLigado; }, [somLigado]);

  const maisNova = leituras[0];
  const chaveNova = maisNova ? `${maisNova.codigo}@${maisNova.em}` : null;

  const [ultimaAnunciada, setUltimaAnunciada] = useState(chaveNova);
  const [anuncio, setAnuncio] = useState(null);

  if (chaveNova !== ultimaAnunciada) {
    setUltimaAnunciada(chaveNova);
    if (chaveNova) setAnuncio({ ...maisNova, chave: chaveNova });
  }

  useEffect(() => {
    if (!anuncio) return undefined;
    if (somRef.current) beepLeituraNova();
    const id = setTimeout(() => setAnuncio(null), 2400);
    return () => clearTimeout(id);
  }, [anuncio]);

  const conectado = ESTADOS_OK.has(estado?.estado);
  const rotulo = estado?.rotulo || "Conectando ao drone";

  const quadros = metricas.quadros ?? 0;
  const lidas = metricas.leituras ?? 0;
  const repetidas = metricas.duplicados ?? 0;
  const msQuadro = metricas.ms_por_quadro;

  const alvos = estado?.alvos || [];
  const largura = estado?.quadro?.largura || 0;
  const altura = estado?.quadro?.altura || 0;

  return (
    <motion.div
      className="dc-tela"
      role="dialog"
      aria-modal="true"
      aria-label="Câmera do drone"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* ── Barra superior ── */}
      <header className="dc-topo">
        <div className="dc-identidade">
          <span className={`dc-pulso${conectado ? " vivo" : ""}`} aria-hidden="true" />
          <div>
            <strong>{rotulo}</strong>
            <small>{estado?.equipamento || "procurando equipamento"}</small>
          </div>
        </div>

        <div className="dc-metricas">
          <Metrica icone={Gauge} valor={metricas.fps ?? "—"} rotulo="fps" />
          <Metrica icone={Layers} valor={quadros} rotulo={plural(quadros, "quadro", "quadros")} />
          <Metrica icone={Crosshair} valor={lidas} rotulo={plural(lidas, "leitura", "leituras")} destaque />
          <Metrica icone={Radio} valor={repetidas} rotulo={plural(repetidas, "repetida", "repetidas")} />
          {msQuadro != null && (
            <Metrica icone={Timer} valor={msQuadro} rotulo="ms/quadro" />
          )}
        </div>

        {/* Como o leitor enxerga. Trocar aqui é o que permite ajustar
            olhando, em vez de no escuro. */}
        {vistas?.length > 1 && (
          <label className="dc-vista">
            <span className="dc-vista-rotulo">Vista</span>
            <select
              value={vista || "ORIGINAL"}
              onChange={(e) => trocarVista(e.target.value)}
            >
              {vistas.map((v) => (
                <option key={v.id} value={v.id}>{v.rotulo}</option>
              ))}
            </select>
          </label>
        )}

        <button
          className="dc-som"
          onClick={() => setSomLigado((v) => !v)}
          aria-pressed={somLigado}
          aria-label={somLigado ? "Desligar o som das leituras" : "Ligar o som das leituras"}
          title={somLigado ? "Som ligado" : "Som desligado"}
        >
          {somLigado
            ? <Volume2 size={16} strokeWidth={1.75} />
            : <VolumeX size={16} strokeWidth={1.75} />}
        </button>

        <button className="dc-fechar" onClick={onFechar} aria-label="Encerrar leitura">
          <X size={18} strokeWidth={2} />
          <span>Encerrar</span>
        </button>
      </header>

      {/* ── O vídeo ── */}
      <div className="dc-palco">
        <div className="dc-visor">
          <div className="dc-quadro">
            {urlVideo && (
              <img
                src={urlVideo}
                alt="Transmissão ao vivo da câmera do drone"
                className={temVideo ? "pronto" : ""}
                onLoad={() => { setTemVideo(true); setSemQuadros(false); }}
              />
            )}

            {/* A mira. Contorna o código; nunca pinta por cima dele. */}
            {temVideo && (
              <DroneMira
                alvos={alvos}
                largura={largura}
                altura={altura}
                procurando={conectado}
              />
            )}

            {/* Leitura confirmada: clarão curto + cartão. Fica na parte
                de BAIXO do quadro, longe de onde a etiqueta costuma
                estar, para não tapar o que acabou de ser lido. */}
            <AnimatePresence>
              {anuncio && (
                <motion.div
                  key={anuncio.chave}
                  className="dc-anuncio"
                  role="status"
                  aria-live="polite"
                  initial={{ opacity: 0, y: 28, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.98 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span className="dc-anuncio-selo" aria-hidden="true">
                    <Check size={20} strokeWidth={3} />
                  </span>
                  <div>
                    <strong>QR Code lido</strong>
                    <p>{anuncio.resumo || anuncio.codigo}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {anuncio && (
              <span key={`${anuncio.chave}-flash`} className="dc-clarao" aria-hidden="true" />
            )}
          </div>

          {/* Moldura do visor: cantos + varredura. Só enfeite, e por
              isso escondida de quem usa leitor de tela. */}
          <div className="dc-moldura" aria-hidden="true">
            <span className="dc-canto ne" /><span className="dc-canto no" />
            <span className="dc-canto se" /><span className="dc-canto so" />
            {conectado && alvos.length === 0 && <span className="dc-varredura" />}
          </div>

          {!temVideo && (
            <div className="dc-esperando" role="status">
              {semQuadros ? (
                <>
                  <WifiOff size={30} strokeWidth={1.5} />
                  <strong>Sem imagem do drone</strong>
                  <p>
                    O leitor está rodando, mas nenhum quadro chegou. Quase
                    sempre é o notebook fora da Wi-Fi do drone — reconecte
                    na rede <code>FLOW-UFO</code> e tente de novo.
                  </p>
                </>
              ) : (
                <>
                  <Loader2 size={30} strokeWidth={1.5} className="dc-girando" />
                  <strong>Abrindo a câmera do drone</strong>
                  <p>Negociando o vídeo. Isso leva alguns segundos.</p>
                </>
              )}
            </div>
          )}

          {erro && (
            <div className="dc-erro" role="alert">
              <AlertTriangle size={28} strokeWidth={1.6} />
              <strong>O leitor parou</strong>
              <p>{erro}</p>
              {log?.length > 0 && (
                <details>
                  <summary>Detalhes técnicos</summary>
                  <pre>{log.slice(-12).join("\n")}</pre>
                </details>
              )}
            </div>
          )}
        </div>

        {/* ── Leituras da sessão ── */}
        <aside className="dc-leituras" aria-label="Leituras desta sessão">
          <header>
            <Wifi size={14} strokeWidth={1.75} aria-hidden="true" />
            <h2>Leituras{empresaNome ? ` · ${empresaNome}` : ""}</h2>
            <span className="dc-contador">{leituras.length}</span>
          </header>

          <div className="dc-lista">
            <AnimatePresence initial={false}>
              {leituras.map((l) => (
                <motion.article
                  key={`${l.codigo}-${l.em}`}
                  className="dc-item"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  <span className="dc-mira" aria-hidden="true">
                    <Crosshair size={13} strokeWidth={2} />
                  </span>

                  <div className="dc-dados">
                    <strong>{l.nome || l.produto_id || "Código lido"}</strong>
                    <div className="dc-detalhes">
                      {l.quantidade != null && (
                        <span><Package size={11} strokeWidth={1.9} /> {l.quantidade} un</span>
                      )}
                      {l.local && (
                        <span><MapPin size={11} strokeWidth={1.9} /> {l.local}</span>
                      )}
                      {l.fragil === "Sim" && (
                        <span className="dc-fragil">
                          <AlertTriangle size={11} strokeWidth={1.9} /> frágil
                        </span>
                      )}
                    </div>
                    {!l.estruturado && <code className="dc-cru">{l.codigo}</code>}
                  </div>

                  <span className="dc-tag">{l.estrategia}</span>
                </motion.article>
              ))}
            </AnimatePresence>

            {leituras.length === 0 && (
              <p className="dc-vazio">
                Aponte o drone para uma etiqueta. Cada código é contado
                <strong> uma vez</strong> — passar de novo pelo mesmo produto
                não duplica o inventário.
              </p>
            )}
          </div>

          {/* O destino de cada leitura, dito em voz alta: terminar um
              inventário achando que ficou salvo seria o pior desfecho
              possível desta tela. */}
          <Registro registro={registro} />
        </aside>
      </div>
    </motion.div>
  );
}
