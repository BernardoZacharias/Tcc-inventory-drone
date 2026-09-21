/*
 * instalador.js — de onde o site oferece o aplicativo para baixar.
 *
 * O Gestock deixou de ser um site com login e virou um APLICATIVO
 * instalável: ele precisa rodar na mesma máquina que enxerga o drone,
 * porque o Wi-Fi do drone é uma rede fechada que a nuvem não alcança.
 * Por isso a chamada principal do site é baixar, e não entrar.
 *
 * O endereço mora aqui, e só aqui, para trocar de lugar sem caçar
 * botão por página. O instalador oficial acompanha o próprio frontend,
 * então o download também funciona na publicação da Vercel sem depender
 * de uma release externa. `VITE_INSTALADOR_URL` continua disponível para
 * substituir o destino no futuro, se necessário.
 */

const ARQUIVO = "Gestock-Drone-Setup-1.0.0.exe";
const PADRAO = `/downloads/${ARQUIVO}`;

export const INSTALADOR = {
  url: import.meta.env?.VITE_INSTALADOR_URL || PADRAO,
  arquivo: ARQUIVO,
  versao: import.meta.env?.VITE_INSTALADOR_VERSAO || "1.0.0",
  tamanho: import.meta.env?.VITE_INSTALADOR_TAMANHO || "76 MB",
  sistema: "Windows 10 ou 11 · 64 bits",
};

/**
 * O que escrever embaixo do botão.
 * Mantido junto do endereço para os dois nunca desencontrarem.
 */
export function detalheDoInstalador() {
  return `${INSTALADOR.sistema} · ${INSTALADOR.tamanho}`;
}
