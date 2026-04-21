// tendencia: { delta: number, anio_ref: number, arriba_es_bueno: boolean, sufijo?: string }
export default function KpiCard({
  titulo,
  valor,
  subtitulo,
  color = "blue",
  icono,
  tendencia = null,
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };

  const iconoColorClasses = {
    blue: "text-blue-500",
    green: "text-green-500",
    amber: "text-amber-500",
    red: "text-red-500",
  };

  function renderTendencia() {
    if (!tendencia || tendencia.delta === null) return null;

    const { delta, anio_ref, arriba_es_bueno = true, sufijo = "" } = tendencia;
    const subiendo = delta > 0;
    const esBueno = subiendo === arriba_es_bueno;
    const esNeutro = delta === 0;

    const claseColor = esNeutro
      ? "text-gray-500"
      : esBueno
        ? "text-green-600"
        : "text-red-600";

    const flecha = esNeutro ? "→" : subiendo ? "↑" : "↓";
    const signo = delta > 0 ? "+" : "";
    const label = `${flecha} ${signo}${delta}${sufijo} vs ${anio_ref}`;

    return (
      <span className={`text-xs font-medium mt-1 block ${claseColor}`}>
        {label}
      </span>
    );
  }

  return (
    <div
      className={`${colorClasses[color]} border rounded-lg p-6 flex items-start gap-4`}
    >
      {icono && (
        <div className={`${iconoColorClasses[color]} text-3xl flex-shrink-0`}>
          {icono}
        </div>
      )}
      <div className="flex-1">
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          {titulo}
        </p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{valor}</p>
        <p className="text-xs text-gray-600 mt-2">{subtitulo}</p>
        {renderTendencia()}
      </div>
    </div>
  );
}
