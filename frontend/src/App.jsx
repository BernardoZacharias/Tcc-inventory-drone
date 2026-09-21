import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { direcaoEntre, deveAnimarTroca, transicaoDeTela } from "./utils/transicao";

/* As telas institucionais, que compartilham a mesma barra de navegação. */
const MOSTRAM_NAVEGACAO = new Set(["home", "about", "technology", "contact"]);
import useReveal from "./hooks/useReveal";
import useScrollFX from "./hooks/useScrollFX";
import "./styles/ScrollFX.css";
import LoadingScreen from "./components/LoadingScreen";
import CursorDrone from "./components/CursorDrone";
import Navbar from "./components/Navbar";

/*
 * As três primeiras telas vêm no pacote inicial; o resto é buscado
 * quando alguém for para lá.
 *
 * Antes tudo vinha junto, e o resultado era um único arquivo de ~500 KB:
 * quem abria a página inicial baixava o painel de relatórios, a tela de
 * alertas e o cockpit do drone sem nunca abrir nenhum deles.
 *
 * Home, Login e Dashboard ficam de fora dessa divisão de propósito —
 * são os pontos de entrada (o site abre na Home, o aplicativo no Login)
 * e dividi-las só trocaria bytes por um piscar de carregamento.
 */
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

const CARREGAR = {
  company: () => import("./pages/CompanyPanel"),
  reading: () => import("./pages/ReadingPanel"),
  about: () => import("./pages/About"),
  technology: () => import("./pages/Technology"),
  contact: () => import("./pages/Contact"),
  companies: () => import("./pages/Companies"),
  operations: () => import("./pages/Operations"),
  reports: () => import("./pages/Reports"),
  alerts: () => import("./pages/Alerts"),
  drones: () => import("./pages/Drones"),
  readings: () => import("./pages/Readings"),
  operators: () => import("./pages/Operators"),
};

const CompanyPanel = lazy(CARREGAR.company);
const ReadingPanel = lazy(CARREGAR.reading);
const About = lazy(CARREGAR.about);
const Technology = lazy(CARREGAR.technology);
const Contact = lazy(CARREGAR.contact);
const Companies = lazy(CARREGAR.companies);
const Operations = lazy(CARREGAR.operations);
const Reports = lazy(CARREGAR.reports);
const Alerts = lazy(CARREGAR.alerts);
const Drones = lazy(CARREGAR.drones);
const Readings = lazy(CARREGAR.readings);
const Operators = lazy(CARREGAR.operators);

/* As telas de trabalho do painel. */
const TELAS_DO_PAINEL = ["companies", "operations", "reports", "alerts",
                         "drones", "readings", "operators", "company", "reading"];

/*
 * Busca os pacotes do painel ANTES de alguém clicar.
 *
 * Dividir o pacote deixou a primeira carga leve, mas empurrou o custo
 * para a navegação: com `fallback` nulo, o intervalo entre pedir a tela
 * e o arquivo chegar é tela em branco. Era esse branco — e não a
 * animação — o "delay grande" ao trocar de tela no painel.
 *
 * Aquecer resolve sem desfazer a divisão: os arquivos chegam enquanto o
 * navegador está ocioso, e o clique encontra tudo em memória. Chamar
 * `import()` de novo depois não custa nada — o módulo já está
 * resolvido, e o próprio bundler devolve a mesma promessa.
 */
let aquecido = false;
function aquecerPainel() {
  if (aquecido) return;
  aquecido = true;
  // Falha aqui não é erro de aplicação: se a rede cair, o carregamento
  // sob demanda tenta de novo na hora do clique, como sempre fez.
  for (const tela of TELAS_DO_PAINEL) CARREGAR[tela]?.().catch(() => {});
}

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

  /*
   * Direção do último movimento: 1 para a frente, -1 para trás, 0 sem
   * deslize. É estado, e não ref, porque as variantes a leem durante a
   * renderização — e ref lido em render volta valor defasado.
   *
   * Muda junto com a rota, no mesmo manipulador de evento, então as
   * duas atualizações entram no mesmo render.
   */
  const [direcao, setDirecao] = useState(0);
  const semMovimento = useReducedMotion();

  /* Só a landing anima a troca; o painel troca de conteúdo direto. */
  const animaTroca = deveAnimarTroca(page);

  const navigate = useCallback((destination, company) => {
    const next = resolveRoute(destination, company, hasSession());
    if (next.page === route.page && next.company?.id === route.company?.id) return;
    setDirecao(direcaoEntre(route.page, next.page));
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
  // Barra de leitura e paralaxe; reancorados na mesma troca
  useScrollFX(`${page}:${booting}`);

  /*
   * Assim que a pessoa chega ao painel, os pacotes das outras telas
   * dele são buscados em segundo plano.
   *
   * `requestIdleCallback` para não disputar banda com o que a tela
   * atual ainda precisa: o aquecimento é uma aposta sobre o próximo
   * clique, e aposta não passa na frente do que já foi pedido. Onde
   * ele não existe (Safari antigo), um timeout serve.
   */
  useEffect(() => {
    if (MOSTRAM_NAVEGACAO.has(page)) return;
    const ocioso = window.requestIdleCallback
      ? window.requestIdleCallback(aquecerPainel, { timeout: 2000 })
      : window.setTimeout(aquecerPainel, 600);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(ocioso);
      else window.clearTimeout(ocioso);
    };
  }, [page]);

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
        {/*
          A NAVEGAÇÃO FICA FORA DA CAMADA QUE ANIMA.

          Cada página institucional montava a sua própria barra, e como
          a barra vinha dentro do bloco animado, ela deslizava junto com
          o conteúdo — a referência fixa da tela saía do lugar a cada
          clique.

          Montada aqui, ela nunca sai do lugar e nunca é remontada: a
          gota do item ativo passa a DESLIZAR de uma aba para a outra,
          em vez de reaparecer no destino.
        */}
        {MOSTRAM_NAVEGACAO.has(page) && <Navbar setPage={setPage} current={page} />}

        {/*
          A landing desliza na direção do clique; o painel, não.

          `mode="wait"` faz a tela que sai terminar antes de a próxima
          entrar — bom para a apresentação, caro para quem trabalha: o
          tempo das duas se soma a cada clique, e no meio dele ainda
          cabia o carregamento do pacote da tela nova.

          Por isso o painel fica FORA do AnimatePresence, em vez de
          dentro dele com duração curta: assim não há quadro de espera
          nenhum, e a troca é imediata.
        */}
        {animaTroca ? (
          <AnimatePresence mode="wait" custom={direcao} initial={false}>
            <motion.div
              key={page}
              custom={direcao}
              variants={semMovimento ? undefined : transicaoDeTela}
              initial="entrar"
              animate="centro"
              exit="sair"
            >
          {page === "home"       && <Home setPage={setPage} />}
          {page === "login"      && <Login setPage={setPage} />}
          {page === "dashboard"  && <Dashboard setPage={setPage} goToCompany={goToCompany} />}

          {/* `fallback` vazio de propósito: numa rede local a tela chega
              em milissegundos, e um spinner piscando seria pior que a
              troca direta. */}
          <Suspense fallback={null}>
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
          </Suspense>
            </motion.div>
          </AnimatePresence>
        ) : (
          <>
            {page === "home"       && <Home setPage={setPage} />}
            {page === "login"      && <Login setPage={setPage} />}
            {page === "dashboard"  && <Dashboard setPage={setPage} goToCompany={goToCompany} />}

            {/* `fallback` vazio de propósito: numa rede local a tela chega
                em milissegundos, e um spinner piscando seria pior que a
                troca direta. */}
            <Suspense fallback={null}>
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
            </Suspense>
          </>
        )}
      </div>
      {booting && <LoadingScreen onComplete={finishIntro} />}
      {!booting && ["home", "about", "technology"].includes(page) && <CursorDrone />}

      {/* Barra de leitura: quanto da página já passou. Fica fora do
          .app-view para não entrar nas transições de troca de tela. */}
      {!booting && <span className="barra-leitura" aria-hidden="true" />}
    </>
  );
}
