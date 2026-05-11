// Tokens de color por variante semántica — usa brand para el azul institucional
const borderColors = {
  blue:   "border-t-brand-500",
  green:  "border-t-green-500",
  amber:  "border-t-amber-500",
  red:    "border-t-red-500",
  purple: "border-t-purple-500",
};

const iconBgColors = {
  blue:   "bg-brand-50 text-brand-600",
  green:  "bg-green-50 text-green-600",
  amber:  "bg-amber-50 text-amber-700",  // amber-700 garantiza contraste WCAG AA
  red:    "bg-red-50 text-red-600",
  purple: "bg-purple-50 text-purple-600",
};

// tendencia: { delta: number, anio_ref: number, arriba_es_bueno: boolean, sufijo?: string }
export default function KpiCard({
  titulo,
  valor,
  subtitulo,
  color = "blue",
  icono,
  tendencia = null,
  onClick = null,
}) {
  function renderTendencia() {
    if (!tendencia || tendencia.delta === null) return null;

    const { delta, anio_ref, arriba_es_bueno = true, sufijo = "" } = tendencia;
    const subiendo = delta > 0;
    const esBueno  = subiendo === arriba_es_bueno;
    const esNeutro = delta === 0;

    const claseColor = esNeutro
      ? "text-slate-400"
      : esBueno
        ? "text-green-700"
        : "text-red-600";

    const flecha = esNeutro ? "→" : subiendo ? "↑" : "↓";
    const signo  = delta > 0 ? "+" : "";

    return (
      <span className={`text-xs font-medium mt-2 block ${claseColor}`}>
        {flecha} {signo}{delta}{sufijo} vs {anio_ref}
      </span>
    );
  }

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={`bg-white border border-surface-border border-t-4 ${borderColors[color]} rounded-lg p-5 flex items-start gap-4 shadow-sm w-full text-left${
        onClick ? " hover:shadow-md hover:border-slate-300 transition-all cursor-pointer" : ""
      }`}
    >
      {icono && (
        <div className={`${iconBgColors[color]} p-2.5 rounded-lg flex-shrink-0`}>
          {icono}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {/* uppercase tracking-wider para etiquetas de KPI — patrón estándar de dashboards */}
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {titulo}
        </p>
        <p className="text-2xl font-bold text-slate-900 mt-1 leading-tight">{valor}</p>
        <p className="text-xs text-slate-500 mt-1">{subtitulo}</p>
        {renderTendencia()}
        {onClick && (
          <span className="text-xs font-medium text-brand-600 mt-2 block">
            Ver alumnos →
          </span>
        )}
      </div>
    </Tag>
  );
}
