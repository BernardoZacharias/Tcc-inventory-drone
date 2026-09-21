import { useEffect, useState } from "react";
import { Sun, Moon, MonitorSmartphone } from "lucide-react";
import { getTheme, setTheme, onSystemThemeChange } from "../utils/theme";

/*
 * Alternador de tema com TRES estados.
 *
 * Um interruptor sol/lua binario esconde uma informacao util: se o
 * usuario quer seguir o sistema operacional. O controle segmentado
 * deixa as tres opcoes visiveis e mostra qual esta ativa.
 */

const OPCOES = [
  { valor: "light",  Icone: Sun,               titulo: "Tema claro" },
  { valor: "system", Icone: MonitorSmartphone, titulo: "Seguir o sistema" },
  { valor: "dark",   Icone: Moon,              titulo: "Tema escuro" }
];

export default function ThemeToggle({ className = "" }) {
  const [tema, setTemaLocal] = useState(getTheme);

  // Se o usuario esta em "system", acompanha a troca no SO
  useEffect(() => onSystemThemeChange(() => setTemaLocal(getTheme())), []);
  useEffect(() => {
    const sync = () => setTemaLocal(getTheme());
    window.addEventListener("gestock:themechange", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gestock:themechange", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function escolher(valor) {
    setTheme(valor);
    setTemaLocal(valor);
  }

  return (
    <div
      className={`theme-switch ${className}`}
      role="group"
      aria-label="Aparência do sistema"
    >
      {OPCOES.map(({ valor, Icone, titulo }) => (
        <button
          key={valor}
          type="button"
          onClick={() => escolher(valor)}
          aria-pressed={tema === valor}
          aria-label={titulo}
          title={titulo}
        >
          <Icone size={15} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
