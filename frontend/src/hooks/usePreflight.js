import { useEffect, useState } from "react";
import { API_URL } from "../services/api";
import { isDesktop } from "../utils/navigation";

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
    const atualiza = (id, estado, detalhe) =>
      vivo && setItens((atual) =>
        atual.map((i) => (i.id === id ? { ...i, estado, detalhe } : i))
      );

    (async () => {
      // API + banco numa tacada: /empresas só responde se o banco responder
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      try {
        const r = await fetch(`${API_URL}/empresas`, { signal: ctrl.signal });
        const dados = await r.json().catch(() => null);

        if (r.ok) {
          atualiza("api", "ok", "conectado");
          const total = dados?.data?.length;
          if (typeof total === "number") {
            atualiza("banco", "ok", `${total} empresa${total === 1 ? "" : "s"}`);
          } else {
            atualiza("banco", "alerta", "sem resposta");
          }
        } else {
          atualiza("api", "alerta", `erro ${r.status}`);
          atualiza("banco", "alerta", "não verificado");
        }
      } catch (e) {
        atualiza("api", "falha", e.name === "AbortError" ? "sem resposta" : "offline");
        atualiza("banco", "falha", "inacessível");
      } finally {
        clearTimeout(t);
      }

      // Só no aplicativo: o Agent precisa de Python na máquina
      if (isDesktop()) {
        try {
          const info = await window.gestock.info();
          if (info?.python) {
            atualiza("agente", "ok", "pronto");
          } else {
            atualiza("agente", "alerta", "Python não encontrado");
          }
        } catch {
          atualiza("agente", "alerta", "indisponível");
        }
      }
    })();

    return () => { vivo = false; };
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
          : "sistema pronto",
    estadoGeral: checando ? PENDENTE : falhas ? "falha" : alertas ? "alerta" : "ok",
  };
}
