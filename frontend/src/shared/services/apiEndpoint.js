export const API_URL = (import.meta.env?.VITE_API_URL || "http://localhost:3000/api").replace(/\/+$/, "");

/** The desktop API can move to the next free port. Never fall back to an
 * unrelated server on port 3000 when the desktop bridge is unavailable. */
export function createApiEndpointResolver({ timeoutMs = 5000 } = {}) {
  let pending = null;
  let currentBridge = null;
  return async function getApiUrl() {
    const bridge = globalThis.window?.gestock;
    if (!bridge?.desktop) return API_URL;
    if (bridge !== currentBridge) {
      pending = null;
      currentBridge = bridge;
    }
    if (!pending) {
      pending = (async () => {
        let timer;
        try {
          const info = await Promise.race([
            Promise.resolve().then(() => bridge.info()),
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error("O aplicativo não informou o endereço do serviço.")), timeoutMs);
            }),
          ]);
          if (!info?.apiUrl) throw new Error("O serviço local não está disponível.");
          const url = new URL(info.apiUrl);
          if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password) {
            throw new Error("Endereço do serviço local inválido.");
          }
          return `${url.origin}/api`;
        } finally {
          clearTimeout(timer);
        }
      })();
    }
    const request = pending;
    try { return await request; }
    catch (error) {
      if (pending === request) pending = null;
      throw error;
    }
  };
}

export const getApiUrl = createApiEndpointResolver();
