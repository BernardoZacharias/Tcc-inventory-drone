import { useEffect, useState } from "react";
import { getApiUrl } from "../../shared/services/api";
import { isDesktop } from "../../shared/utils/navigation";
import { preflightStatus } from "../utils/preflightStatus";

/*
 * usePreflight — checagem pré-voo dos componentes do sistema.
 *
 * A tela de acesso é o único momento em que o operador está parado
 * esperando. É o lugar certo para responder, antes que ele pergunte,
 * se o sistema está pronto para voar: a API responde? o banco tem
 * dados? há Python para o Agent do drone?
 *
 * Descobrir isso depois de logar, no meio do galpão com o drone na
 * mão, é tarde demais.
 */

const PENDENTE = "checando";

export default function usePreflight() {
  const [itens, setItens] = useState(() => {
    const base = [
      { id: "painel", rotulo: "Painel", estado: "ok", detalhe: "carregado" },
      { id: "api", rotulo: "Serviço", estado: PENDENTE, detalhe: "" },
      { id: "banco", rotulo: "Banco de dados", estado: PENDENTE, detalhe: "" },
    ];
    if (isDesktop()) {
      base.push({ id: "agente", rotulo: "Leitor do drone", estado: PENDENTE, detalhe: "" });
    }
    return base;
  });

  useEffect(() => {
    let vivo = true;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const atualiza = (id, estado, detalhe) =>
      vivo && setItens((atual) =>
        atual.map((i) => (i.id === id ? { ...i, estado, detalhe } : i))
      );

    (async () => {
      // API + banco numa tacada: /empresas só responde se o banco responder
      try {
        const baseUrl = await getApiUrl();
        if (!vivo) return;
        const r = await fetch(`${baseUrl}/empresas`, { signal: ctrl.signal });
        const dados = await r.json().catch(() => null);
        const status = preflightStatus(r.status, dados);
        atualiza("api", ...status.api);
        atualiza("banco", ...status.banco);
      } catch (e) {
        atualiza("api", "falha", e.name === "AbortError" ? "sem resposta" : "offline");
        atualiza("banco", "alerta", "não verificado");
      } finally {
        clearTimeout(t);
      }
    })();

    let agentTimer;
    (async () => {
      // Só no aplicativo: o Agent precisa de Python na máquina
      if (isDesktop()) {
        try {
          const info = await Promise.race([
            window.gestock.info(),
            new Promise((_, reject) => {
              agentTimer = setTimeout(() => reject(new Error("timeout")), 6000);
            }),
          ]);
          if (info?.python) {
            atualiza("agente", "ok", "Python encontrado");
          } else {
            atualiza("agente", "alerta", "Python não encontrado");
          }
        } catch {
          atualiza("agente", "alerta", "indisponível");
        } finally {
          clearTimeout(agentTimer);
        }
      }
    })();

    return () => {
      vivo = false;
      ctrl.abort();
      clearTimeout(t);
      clearTimeout(agentTimer);
    };
  }, []);

  const checando = itens.some((i) => i.estado === PENDENTE);
  const falhas = itens.filter((i) => i.estado === "falha").length;
  const alertas = itens.filter((i) => i.estado === "alerta").length;

  return {
    itens,
    checando,
    resumo: checando
      ? "verificando sistema"
      : falhas
        ? "sistema indisponível"
        : alertas
          ? "pronto com ressalvas"
          : "verificações concluídas",
    estadoGeral: checando ? PENDENTE : falhas ? "falha" : alertas ? "alerta" : "ok",
  };
}
