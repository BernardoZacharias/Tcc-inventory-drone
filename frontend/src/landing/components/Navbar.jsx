import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { House, Info, Cpu, Mail } from "lucide-react";
import BotaoInstalador from "./BotaoInstalador";
import NavGoo, { FiltroGoo } from "./NavGoo";
import "../styles/NavGoo.css";
import ThemeToggle from "../../shared/components/ThemeToggle";
import NavigationDialog from "../../shared/components/NavigationDialog";
import logo from "../../shared/assets/logo-gestock.png";

const ITENS = [
  { key: "home",       label: "Início",          Icone: House },
  { key: "about",      label: "Sobre o sistema", Icone: Info },
  { key: "technology", label: "Tecnologia",      Icone: Cpu },
  { key: "contact",    label: "Contato",         Icone: Mail }
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
  const navRef = useRef(null);

  const AtivoIcone = (ITENS.find((i) => i.key === current) || ITENS[0]).Icone;

  function ir(destino) {
    setAberto(false);
    setPage(destino);
  }

  return (
    <>
      <FiltroGoo />

      <motion.header
        className="navbar"
        initial={{ y: -12, opacity: 0.72 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      >
        <button className="navbar-logo" onClick={() => ir("home")} title="Gestock — início">
          <img src={logo} alt="Gestock" />
        </button>

        <nav ref={navRef} className="navbar-nav" aria-label="Navegação principal">
          <NavGoo ativo={current} icone={<AtivoIcone />} />

          {ITENS.map((it) => (
            <button
              key={it.key}
              className={`nav-link${current === it.key ? " active" : ""}`}
              onClick={() => ir(it.key)}
              aria-current={current === it.key ? "page" : undefined}
              data-nav={it.key}
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
