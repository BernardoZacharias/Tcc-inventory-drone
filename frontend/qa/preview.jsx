import { useState } from "react";
import { MotionConfig } from "framer-motion";
import Dashboard from "../src/pages/Dashboard";
import Companies from "../src/pages/Companies";
import Operations from "../src/pages/Operations";
import Reports from "../src/pages/Reports";
import Alerts from "../src/pages/Alerts";
import Drones from "../src/pages/Drones";
import Operators from "../src/pages/Operators";
import Readings from "../src/pages/Readings";
import ReadingPanel from "../src/pages/ReadingPanel";
import CompanyPanel from "../src/pages/CompanyPanel";
import Login from "../src/pages/Login";
import ThemeToggle from "../src/components/ThemeToggle";
import ToastHub from "../src/components/Toast";
import { setScenario } from "./api";
import "../src/styles/global.css";
import "../src/styles/tailwind.css";
import "../src/styles/polish.css";
import "../src/styles/MarketingFlow.css";
import "../src/styles/Experience.css";

const pages = { login: Login, dashboard: Dashboard, companies: Companies, operations: Operations, reports: Reports, alerts: Alerts, drones: Drones, operators: Operators, readings: Readings, reading: ReadingPanel, company: CompanyPanel };
export default function Preview() {
  const [page, setPage] = useState("dashboard");
  const [mode, setMode] = useState("populated");
  const Page = pages[page] || Dashboard;
  return <MotionConfig reducedMotion="user">
    <header style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: 12, background: "var(--bg-1)", borderBottom: "1px solid var(--amber)", position: "relative", zIndex: 201 }}>
      <strong style={{ color: "var(--amber)", fontSize: 13 }}>PRÉVIA ISOLADA · dados fictícios · gravações bloqueadas</strong>
      <ThemeToggle />
      <select aria-label="Tela de teste" value={page} onChange={(event) => setPage(event.target.value)}>{Object.keys(pages).map((key) => <option key={key}>{key}</option>)}</select>
      <select aria-label="Cenário de teste" value={mode} onChange={(event) => { setScenario(event.target.value); setMode(event.target.value); }}><option value="populated">Com dados</option><option value="empty">Vazio</option><option value="error">Erro de conexão</option><option value="loading">Carregando</option></select>
    </header>
    <Page key={`${page}-${mode}`} setPage={setPage} goToCompany={() => setPage("company")} company={{ id: 1, name: "Atlas Logística", segment: "Distribuição" }} />
    <ToastHub />
  </MotionConfig>;
}
