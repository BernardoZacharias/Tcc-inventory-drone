export default function MetricCard({ title, value, icon: Icon, onClick, accent = "cyan", hint }) {
  const Element = onClick ? "button" : "div";
  return (
    <Element
      type={onClick ? "button" : undefined}
      className={`metric-card accent-${accent}`}
      onClick={onClick}
      style={{ textAlign: "left", width: "100%" }}
    >
      <div className="metric-content">
        <span className="metric-title">{title}</span>
        <strong className="metric-value">{value}</strong>
        {hint && <span className="metric-hint">{hint}</span>}
      </div>
      <div className="metric-icon">
        <Icon size={22} aria-hidden="true" />
      </div>
      <div className="metric-glow" />
    </Element>
  );
}
