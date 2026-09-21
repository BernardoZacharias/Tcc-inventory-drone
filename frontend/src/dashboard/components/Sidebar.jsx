import { useRef, useState } from "react";
import {
  LayoutDashboard, Building2, QrCode, Radar,
  FileText, Bell, Plane, Users, LogOut, Menu
} from "lucide-react";
import logo from "../../shared/assets/logo-gestock.png";
import ThemeToggle from "../../shared/components/ThemeToggle";
import NavigationDialog from "../../shared/components/NavigationDialog";
import { isAdmin, getCurrentUser, logout } from "../../shared/utils/auth";
import { isDesktop } from "../../shared/utils/navigation";

const BASE_ITEMS = [
  { key: "dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { key: "companies",  label: "Empresas",   icon: Building2 },
  { key: "operations", label: "Operações",  icon: Radar },
  { key: "readings",   label: "Leituras",   icon: QrCode },
  { key: "reports",    label: "Relatórios", icon: FileText },
  { key: "alerts",     label: "Alertas",    icon: Bell },
  { key: "drones",     label: "Drones",     icon: Plane }
];

export default function Sidebar({ active, setPage }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef(null);
  const admin = isAdmin();
  const user = getCurrentUser();

  // "Operadores" só aparece para o admin
  const items = admin
    ? [...BASE_ITEMS, { key: "operators", label: "Operadores", icon: Users }]
    : BASE_ITEMS;

  function handleLogout() {
    logout();
    // No aplicativo o destino depois de sair é a tela de acesso;
    // no site, a landing page.
    setPage(isDesktop() ? "login" : "home");
  }

  return (
    <>
    <header className="workspace-mobilebar">
      <button type="button" onClick={() => setPage("dashboard")} aria-label="Gestock — dashboard">
        <img src={logo} alt="" />
      </button>
      <span>{items.find((item) => item.key === active)?.label || "Gestão"}</span>
      <button type="button" ref={triggerRef} className="icon-button" aria-label="Abrir navegação do sistema" aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
        <Menu size={23} aria-hidden="true" />
      </button>
    </header>
    <aside className="sidebar" aria-label="Navegação do sistema">
      <button className="sidebar-brand" onClick={() => setPage("dashboard")}>
        <img src={logo} alt="Gestock" className="sidebar-logo-img" />
      </button>

      <div className="sidebar-user">
        <span className="sidebar-user-avatar">
          {(user?.nome || "U").charAt(0).toUpperCase()}
        </span>
        <div className="sidebar-user-info">
          <strong>{user?.nome || "Usuário"}</strong>
          <span>{admin ? "Administrador" : "Operador"}</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Seções">
        {items.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`sidebar-link${active === key ? " active" : ""}`}
            onClick={() => setPage(key)}
            aria-current={active === key ? "page" : undefined}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <ThemeToggle className="sidebar-theme" />
        <button className="sidebar-link logout" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
    <NavigationDialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Seu espaço de trabalho" triggerRef={triggerRef}>
      <p className="navigation-dialog__identity">{user?.nome || "Usuário"} · {admin ? "Administrador" : "Operador"}</p>
      <nav className="sidebar-nav" aria-label="Seções do sistema">
        {items.map(({ key, label, icon: Icon }) => (
          <button type="button" key={key} className={`sidebar-link${active === key ? " active" : ""}`} aria-current={active === key ? "page" : undefined} onClick={() => { setMenuOpen(false); setPage(key); }}>
            <Icon size={19} aria-hidden="true" /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="navigation-dialog__footer">
        <ThemeToggle />
        <button type="button" className="sidebar-link logout" onClick={handleLogout}><LogOut size={18} aria-hidden="true" />Sair</button>
      </div>
    </NavigationDialog>
    </>
  );
}
