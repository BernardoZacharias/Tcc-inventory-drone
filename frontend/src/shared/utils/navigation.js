export const PAGE_TITLES = {
  home: "Inventário inteligente", login: "Acessar sistema", dashboard: "Dashboard",
  company: "Painel da empresa", reading: "Central de leitura", about: "Sobre o sistema",
  technology: "Tecnologia", contact: "Contato", companies: "Empresas",
  operations: "Operações", reports: "Relatórios", alerts: "Alertas",
  drones: "Drones", readings: "Leituras", operators: "Operadores",
};

const PUBLIC_PAGES = new Set(["home", "login", "about", "technology", "contact"]);

/*
 * Páginas institucionais: existem para quem chega pelo site e precisa
 * entender o produto. Quem já instalou o aplicativo não precisa ser
 * convencido — abre para trabalhar.
 */
const MARKETING_PAGES = new Set(["home", "about", "technology", "contact"]);

/** Roda dentro do aplicativo instalado? (definido pelo preload do Electron) */
export function isDesktop() {
  return Boolean(globalThis.window?.gestock?.desktop);
}

/** Onde o usuário cai quando não pediu uma tela específica. */
export function defaultRoute(authenticated) {
  if (isDesktop()) return authenticated ? "dashboard" : "login";
  return "home";
}

// This is only a navigation guard; permissions must still be enforced by the API.
export function resolveRoute(page, company, authenticated) {
  const inicial = defaultRoute(authenticated);

  if (!Object.hasOwn(PAGE_TITLES, page)) return { page: inicial, company: null };

  // No aplicativo não há landing page: qualquer tentativa de chegar nela
  // (link antigo, hash na URL) cai direto no trabalho.
  if (isDesktop() && MARKETING_PAGES.has(page)) return { page: inicial, company: null };

  if (!PUBLIC_PAGES.has(page) && !authenticated) return { page: "login", company: null };
  if (page === "company" && !company?.id) return { page: "companies", company: null };
  return { page, company: company || null };
}
