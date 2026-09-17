import { useCallback, useEffect, useRef, useState } from "react";
import { isDesktop } from "../utils/navigation";

/*
 * useDroneAgent — liga e desliga o Agent do drone, e acompanha o que
 * ele está vendo.
 *
 * O Agent é um processo Python que o aplicativo inicia. Ele publica o
 * vídeo e o estado num servidor HTTP que só escuta em 127.0.0.1. Aqui
 * a gente:
 *
 *   1. manda iniciar (via ponte do Electron);
 *   2. espera a PORTA aparecer — ela não vem na resposta do "iniciar",
 *      porque o Python só a anuncia quando o servidor sobe de fato;
 *   3. passa a ler /estado de lá para alimentar a tela.
 *
 * Só funciona dentro do aplicativo. No navegador não há Agent para
 * iniciar, e o hook devolve `disponivel: false` em vez de quebrar.
 */

const INTERVALO_ESTADO = 700;    // o suficiente para a tela parecer viva
const ESPERA_PORTA_MS = 20000;   // o Agent pode demorar a achar o drone

export default function useDroneAgent() {
  const disponivel = isDesktop();

  const [ligando, setLigando] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [porta, setPorta] = useState(null);
  const [erro, setErro] = useState("");
  const [estado, setEstado] = useState(null);
  const [log, setLog] = useState([]);

  const vivoRef = useRef(true);
  const rodandoRef = useRef(false);
  useEffect(() => { rodandoRef.current = rodando; }, [rodando]);

  /*
   * Sair da tela encerra o Agent.
   *
   * Sem isto, navegar para outra página deixa um Python invisível
   * segurando o vídeo do drone: consome CPU, ocupa a porta e continua
   * contando leituras que ninguém vê. Ao voltar, a sessão pareceria
   * "já ter lido" coisas.
   */
  useEffect(() => () => {
    vivoRef.current = false;
    if (rodandoRef.current && isDesktop()) {
      try {
        window.gestock.agente.parar();
      } catch {
        /* o app está fechando; o main process também encerra o Agent */
      }
    }
  }, []);

  const limpar = useCallback(() => {
    setRodando(false);
    setPorta(null);
    setEstado(null);
  }, []);

  /** Inicia o Agent e espera o servidor local subir. */
  const iniciar = useCallback(async (opcoes = {}) => {
    if (!disponivel) {
      setErro("O leitor do drone só funciona no aplicativo instalado.");
      return { ok: false };
    }

    setErro("");
    setLigando(true);

    try {
      const r = await window.gestock.agente.iniciar(opcoes);
      if (!r?.ok) {
        setErro(r?.mensagem || "Não foi possível iniciar o leitor do drone.");
        setLigando(false);
        return { ok: false };
      }

      // A porta chega pelo stdout do Python, um instante depois.
      const limite = Date.now() + ESPERA_PORTA_MS;
      while (Date.now() < limite) {
        if (!vivoRef.current) return { ok: false };
        const e = await window.gestock.agente.estado();

        if (e?.porta) {
          setPorta(e.porta);
          setRodando(true);
          setLigando(false);
          return { ok: true, porta: e.porta };
        }

        // Morreu antes de abrir o servidor: mostrar o motivo real, que
        // está no log do Python, e não um "falhou" genérico.
        if (e && !e.rodando) {
          setErro(e.erro || "O leitor encerrou antes de abrir o vídeo.");
          setLog(e.saida || []);
          setLigando(false);
          return { ok: false };
        }

        await new Promise((r2) => setTimeout(r2, 350));
      }

      setErro("O leitor não respondeu a tempo. Verifique se o notebook " +
              "está na Wi-Fi do drone.");
      setLigando(false);
      return { ok: false };
    } catch (e) {
      setErro(e?.message || "Falha ao falar com o leitor.");
      setLigando(false);
      return { ok: false };
    }
  }, [disponivel]);

  const parar = useCallback(async () => {
    if (!disponivel) return;
    try {
      await window.gestock.agente.parar();
    } catch {
      /* se já morreu, o resultado é o mesmo */
    }
    limpar();
  }, [disponivel, limpar]);

  /* Enquanto estiver rodando, lê o estado direto do Agent. */
  useEffect(() => {
    if (!rodando || !porta) return undefined;

    let cancelado = false;
    let emVoo = false;

    const tick = async () => {
      if (cancelado || emVoo || document.hidden) return;
      emVoo = true;
      try {
        const r = await fetch(`http://127.0.0.1:${porta}/estado`, {
          cache: "no-store",
        });
        const dados = await r.json();
        if (!cancelado) setEstado(dados);
      } catch {
        // Uma falha isolada é normal (o Agent pode estar reconectando).
        // Quem decide que morreu é o próprio processo, abaixo.
        if (!cancelado) {
          try {
            const e = await window.gestock.agente.estado();
            if (!e?.rodando && !cancelado) {
              setErro(e?.erro || "O leitor do drone encerrou.");
              setLog(e?.saida || []);
              limpar();
            }
          } catch { /* ignora */ }
        }
      } finally {
        emVoo = false;
      }
    };

    tick();
    const id = setInterval(tick, INTERVALO_ESTADO);
    return () => { cancelado = true; clearInterval(id); };
  }, [rodando, porta, limpar]);

  return {
    disponivel,
    ligando,
    rodando,
    porta,
    erro,
    log,
    estado,
    leituras: estado?.leituras || [],
    metricas: estado?.metricas || {},
    urlVideo: porta ? `http://127.0.0.1:${porta}/video` : null,
    iniciar,
    parar,
    limparErro: () => setErro(""),
  };
}
