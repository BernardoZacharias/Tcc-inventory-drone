import { AlertCircle, LoaderCircle, RefreshCw, Search } from "lucide-react";
import "../styles/OperationsUX.css";

export function OperationsFeedback({ loading, error, updatedAt, onRetry }) {
  if (!loading && !error) return null;
  return (
    <div className={`operations-feedback${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>
      {error ? <AlertCircle size={18} aria-hidden="true" /> : <LoaderCircle size={18} className="operations-spinner" aria-hidden="true" />}
      <span>{error || (updatedAt ? "Atualizando dados…" : "Carregando dados…")}
        {error && updatedAt && <small>Exibindo os últimos dados recebidos às {updatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</small>}
      </span>
      {error && <button type="button" onClick={onRetry} disabled={loading}><RefreshCw size={14} aria-hidden="true" /> {loading ? "Tentando…" : "Tentar novamente"}</button>}
    </div>
  );
}

export function OperationsSearch({ value, onChange, label, placeholder }) {
  return (
    <label className="operations-search">
      <span className="operations-sr-only">{label}</span>
      <Search size={16} aria-hidden="true" />
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder || label} />
      {value && <button type="button" onClick={() => onChange("")} aria-label={`Limpar ${label.toLowerCase()}`}>Limpar</button>}
    </label>
  );
}
