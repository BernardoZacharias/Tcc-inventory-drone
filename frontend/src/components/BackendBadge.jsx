import { useEffect, useState } from "react";
import { Wifi, WifiOff, Loader } from "lucide-react";
import { backendStatus, listarEmpresas } from "../services/api";

export default function BackendBadge() {
  const [state, setState] = useState(backendStatus());

  useEffect(() => {
    let stopped = false;
    async function probe() {
      const response = await listarEmpresas();
      if (!stopped) setState(Boolean(response?.success));
    }
    probe();
    const id = setInterval(probe, 15000);
    return () => { stopped = true; clearInterval(id); };
  }, []);

  let label, Icon, cls;
  if (state === null)       { label = "Verificando...";  Icon = Loader;  cls = "checking"; }
  else if (state === true)  { label = "Conectado";  Icon = Wifi;    cls = "on"; }
  else                       { label = "Conexão indisponível"; Icon = WifiOff; cls = "off"; }

  return (
    <span className={`backend-badge ${cls}`} title={label}>
      <Icon size={13} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
