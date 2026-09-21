import { ArrowUpRight } from "lucide-react";
import "../styles/Button.css";

/*
 * Botão em pílula com ícone ANINHADO.
 *
 * A seta nunca fica solta ao lado do texto: ela mora dentro do
 * próprio círculo, encostada na borda interna direita. No hover o
 * círculo anda na diagonal, criando tensão cinética dentro do botão.
 *
 *   <Button icon>Acessar sistema</Button>     -> seta padrão
 *   <Button icon={Radar}>Ver leituras</Button> -> ícone próprio
 *   <Button>Salvar</Button>                    -> sem ícone
 */
export default function Button({
  children,
  variant = "primary",
  onClick,
  type = "button",
  icon = false,
  disabled = false,
  className = "",
  ...rest
}) {
  const Icone = icon === true ? ArrowUpRight : icon || null;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`button ${variant} ${className}`}
      {...rest}
    >
      <span className="button-label">{children}</span>

      {Icone && (
        <span className="button-ico" aria-hidden="true">
          {/* traço fino: linha precisa, nunca pesada */}
          <Icone size={15} strokeWidth={1.75} />
        </span>
      )}
    </button>
  );
}
