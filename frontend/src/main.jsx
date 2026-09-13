import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { MotionConfig } from "framer-motion";
import ToastHub from "./components/Toast";
import CursorDrone from "./components/CursorDrone";
import "./styles/global.css";
// polish.css por ultimo: sobrepoe as folhas de cada pagina
import "./styles/polish.css";
// Continuidade visual das páginas institucionais (carregado por último)
import "./styles/MarketingFlow.css";
import "./styles/Experience.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
    <a className="skip-link" href="#conteudo" onClick={(event) => {
      event.preventDefault();
      const target = document.querySelector(".app-view main h1, .app-view main h2") || document.getElementById("conteudo");
      target.tabIndex = -1;
      target.focus();
    }}>Pular para o conteúdo</a>
    <App />
    <ToastHub />
    <CursorDrone />
    </MotionConfig>
  </React.StrictMode>
);
