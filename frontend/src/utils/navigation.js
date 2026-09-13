export const PAGE_TITLES = {
  home: "Inventário inteligente", login: "Acessar sistema", dashboard: "Dashboard",
  company: "Painel da empresa", reading: "Central de leitura", about: "Sobre o sistema",
  technology: "Tecnologia", contact: "Contato", companies: "Empresas",
  operations: "Operações", reports: "Relatórios", alerts: "Alertas",
  drones: "Drones", readings: "Leituras", operators: "Operadores",
};

const PUBLIC_PAGES = new Set(["home", "login", "about", "technology", "contact"]);

// This is only a navigation guard; permissions must still be enforced by the API.
export function resolveRoute(page, company, authenticated) {
  if (!Object.hasOwn(PAGE_TITLES, page)) return { page: "home", company: null };
  if (!PUBLIC_PAGES.has(page) && !authenticated) return { page: "login", company: null };
  if (page === "company" && !company?.id) return { page: "companies", company: null };
  return { page, company: company || null };
}
