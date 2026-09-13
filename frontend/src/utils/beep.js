/*
 * Beep sintetizado via Web Audio API.
 * Não precisa de arquivo .mp3 nem de assets.
 */

let _ctx = null;

function getCtx() {
  if (!_ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _ctx = new AC();
  }
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

/**
 * Toca um bip curto.
 * @param {number} freq      Frequência em Hz (padrão 1400 = agudo)
 * @param {number} duration  Duração em ms
 * @param {number} volume    0..1
 */
export function beep(freq = 1400, duration = 140, volume = 0.18) {
  const ctx = getCtx();
  if (!ctx) return;

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration / 1000);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration / 1000 + 0.02);
}

/** Beep "dois tons" — usado quando uma nova leitura QR aparece. */
export function beepLeituraNova() {
  beep(1300, 110, 0.20);
  setTimeout(() => beep(1850, 130, 0.18), 110);
}

/** Beep grave para alertas críticos. */
export function beepAlerta() {
  beep(420, 220, 0.22);
  setTimeout(() => beep(300, 260, 0.22), 220);
}
