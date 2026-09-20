import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import useReveal from "./hooks/useReveal";
import LoadingScreen from "./components/LoadingScreen";
import CursorDrone from "./components/CursorDrone";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CompanyPanel from "./pages/CompanyPanel";
import ReadingPanel from "./pages/ReadingPanel";
import About from "./pages/About";
import Technology from "./pages/Technology";
import Contact from "./pages/Contact";
import Companies from "./pages/Companies";
import Operations from "./pages/Operations";
import Reports from "./pages/Reports";
import Alerts from "./pages/Alerts";
import Drones from "./pages/Drones";
import Readings from "./pages/Readings";
import Operators from "./pages/Operators";
import { getCurrentUser } from "./utils/auth";
import { PAGE_TITLES, resolveRoute, defaultRoute, isDesktop } from "./utils/navigation";
import { EVENTO_SESSAO_EXPIRADA } from "./services/api";
import { toast } from "./services/toast";

function hasSession() {
  try { return Boolean(getCurrentUser() && localStorage.getItem("token")); }
  catch { return false; }
}

function readRoute() {
  const autenticado = hasSession();
  // Sem hash na URL (o caso do aplicativo, que abre em file://) a tela
  // inicial vem do ambiente: site abre na landing, app abre no trabalho.
  const requestedPage = window.location.hash.startsWith("#/")
    ? window.location.hash.slice(2)
    : defaultRoute(autenticado);
  return resolveRoute(requestedPage, window.history.state?.gestock?.company, autenticado);
}

function shouldShowIntro() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  // A abertura animada apresenta a marca a quem chega pelo site. Num
  // aplicativo de trabalho ela só atrasaria o login.
  if (isDesktop()) return false;
  if (window.location.hash && window.location.hash !== "#/home") return false;
  try { return !sessionStorage.getItem("gestock-intro-seen"); }
  catch { return true; }
}

export default function App() {
  const [booting, setBooting] = useState(shouldShowIntro);
  const [route, setRoute] = useState(readRoute);
  const { page, company: selectedCompany } = route;

  const finishIntro = useCallback(() => {
    try { sessionStorage.setItem("gestock-intro-seen", "true"); }
    catch { /* The animation remains usable without browser storage. */ }
    setBooting(false);
  }, []);

  const navigate = useCallback((destination, company) => {
    const next = resolveRoute(destination, company, hasSession());
    if (next.page === route.page && next.company?.id === route.company?.id) return;
    window.history.pushState({ ...window.history.state, gestock: next }, "", `#/${next.page}`);
    setRoute(next);
  }, [route]);
  const setPage = useCallback((destination) => navigate(destination, selectedCompany), [navigate, selectedCompany]);

  useEffect(() => {
    const restore = () => {
      const next = readRoute();
      window.history.replaceState({ ...window.history.state, gestock: next }, "", `#/${next.page}`);
      setRoute(next);
    };
    window.addEventListener("popstate", restore);
    window.addEventListener("hashchange", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("hashchange", restore);
    };
  }, []);

  /*
   * Sessão expirada (o token dura 8 horas).
   *
   * Antes, a tela só exibia o erro e o usuário ficava parado nela sem
   * saber que precisava sair e entrar de novo. Agora o caminho é feito
   * por ele: a sessão já foi encerrada pelo cliente da API, e aqui ele
   * é levado à tela de acesso com a explicação.
   */
  useEffect(() => {
    const aoExpirar = () => {
      toast.info("Sua sessão expirou. Entre novamente para continuar.");
      navigate("login", null);
    };
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
  }, [navigate]);

  // Reobserva os elementos .reveal a cada troca de tela
  useReveal(`${page}:${booting}`);

  // Cada navegação começa no hero antes da nova tela ser pintada.
  useLayoutEffect(() => {
    document.title = `${PAGE_TITLES[page]} · Gestock`;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (booting) return;
    const initialField = document.querySelector(".app-view [data-route-autofocus]");
    if (initialField && window.matchMedia("(min-width: 1024px)").matches) {
      initialField.focus({ preventScroll: true });
      return;
    }
    const heading = document.querySelector(".app-view h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [page, booting]);

  const goToCompany = (company) => {
    navigate("company", company);
  };

  return (
    <>
      <div
        className="app-view"
        id="conteudo"
        tabIndex={-1}
        aria-hidden={booting || undefined}
        inert={booting || undefined}
      >
        {page === "home"       && <Home setPage={setPage} />}
        {page === "login"      && <Login setPage={setPage} />}
        {page === "dashboard"  && <Dashboard setPage={setPage} goToCompany={goToCompany} />}
        {page === "company"    && <CompanyPanel setPage={setPage} company={selectedCompany} />}
        {page === "reading"    && <ReadingPanel setPage={setPage} company={selectedCompany} />}
        {page === "about"      && <About setPage={setPage} />}
        {page === "technology" && <Technology setPage={setPage} />}
        {page === "contact"    && <Contact setPage={setPage} />}
        {page === "companies"  && <Companies setPage={setPage} goToCompany={goToCompany} />}
        {page === "operations" && <Operations setPage={setPage} />}
        {page === "reports"    && <Reports setPage={setPage} />}
        {page === "alerts"     && <Alerts setPage={setPage} />}
        {page === "drones"     && <Drones setPage={setPage} />}
        {page === "readings"   && <Readings setPage={setPage} />}
        {page === "operators"  && <Operators setPage={setPage} />}
      </div>
      {booting && <LoadingScreen onComplete={finishIntro} />}
      {!booting && ["home", "about", "technology"].includes(page) && <CursorDrone />}
    </>
  );
}
