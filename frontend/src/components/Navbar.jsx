import { useRef, useState } from "react";
import { motion } from "framer-motion";
import BotaoInstalador from "./BotaoInstalador";
import ThemeToggle from "./ThemeToggle";
import NavigationDialog from "./NavigationDialog";
import logo from "../assets/logo-gestock.png";

const ITENS = [
  { key: "home",       label: "Início" },
  { key: "about",      label: "Sobre o sistema" },
  { key: "technology", label: "Tecnologia" },
  { key: "contact",    label: "Contato" }
];

/*
 * Navegação "Ilha Fluida": uma pílula de vidro destacada do topo,
 * centralizada e do tamanho do próprio conteúdo — nunca colada
 * de ponta a ponta na borda superior.
 *
 * No mobile vira um menu em tela cheia com revelação escalonada.
 */
export default function Navbar({ setPage, current = "home" }) {
  const [aberto, setAberto] = useState(false);
  const triggerRef = useRef(null);

  function ir(destino) {
    setAberto(false);
    setPage(destino);
  }

  return (
    <>
      <motion.header
        className="navbar"
        initial={{ y: -12, opacity: 0.72 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      >
        <button className="navbar-logo" onClick={() => ir("home")} title="Gestock — início">
          <img src={logo} alt="Gestock" />
        </button>

        <nav className="navbar-nav" aria-label="Navegação principal">
          {ITENS.map((it) => (
            <button
              key={it.key}
              className={`nav-link${current === it.key ? " active" : ""}`}
              onClick={() => ir(it.key)}
              aria-current={current === it.key ? "page" : undefined}
            >
              {it.label}
            </button>
          ))}
        </nav>

        <div className="navbar-actions">
          <ThemeToggle />
          <BotaoInstalador detalhe={false} />

          {/* Hambúrguer que morfa em X — as linhas giram, não somem */}
          <button
            ref={triggerRef}
            type="button"
            className="nav-burger"
            aria-haspopup="dialog"
            aria-expanded={aberto}
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            onClick={() => setAberto((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </motion.header>

      <NavigationDialog open={aberto} onClose={() => setAberto(false)} title="Explorar o Gestock" triggerRef={triggerRef}>
          <nav className="navigation-dialog__links" aria-label="Navegação principal">
            {ITENS.map((it) => (
              <button type="button" key={it.key} aria-current={current === it.key ? "page" : undefined} onClick={() => ir(it.key)}>
                {it.label}
              </button>
            ))}
          </nav>
          <BotaoInstalador />

          {/* O painel web continua existindo para quem já usa o sistema;
              ele só deixou de ser a chamada principal do site. Sem este
              caminho, entrar exigiria digitar a URL na mão. */}
          <button type="button" className="navigation-dialog__entrar" onClick={() => ir("login")}>
            Já uso o Gestock — entrar no painel
          </button>
      </NavigationDialog>
    </>
  );
}
