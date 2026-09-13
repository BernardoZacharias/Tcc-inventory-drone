import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/*
 * O caminho dos assets muda conforme o destino do build:
 *
 *   web (Vercel) ...... base "/"   — servido por um servidor HTTP
 *   desktop (Electron)  base "./"  — carregado via file://
 *
 * Sem o "./" no desktop, o index.html pede "/assets/index.js", que no
 * protocolo file:// aponta para a RAIZ DO DISCO e não para a pasta do
 * aplicativo. A janela abre em branco, sem erro visível.
 *
 * O build do desktop define GESTOCK_TARGET=desktop (ver desktop/package.json).
 */
const paraDesktop = process.env.GESTOCK_TARGET === 'desktop'

// https://vite.dev/config/
export default defineConfig({
  base: paraDesktop ? './' : '/',
  plugins: [react()],
})
