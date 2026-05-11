function getStatusColor(status) {
  if (status === "aprobada")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "cursando") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "recursada")
    return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function getMetricTextClass(metric, value) {
  if (value === null || value === undefined) {
    return "text-slate-700";
  }

  if (metric === "asistencia") {
    return value < 0.7 ? "text-red-600" : "text-green-700";
  }

  if (metric === "promedio") {
    return value < 4 ? "text-red-600" : "text-green-700";
  }

  return "text-slate-700";
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${Math.round(Number(value) * 100)}%`;
}

function formatGrade(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  return Number(value).toFixed(1);
}

export default function MateriaCard({ materia, status, onClick }) {
  const statusLabel =
    status === "cursando"
      ? "Cursando"
      : status === "finalesPendientes"
        ? "Final pendiente"
        : status === "aprobadas"
          ? "Aprobada"
          : "Recursada";

  return (
    <button
      type="button"
      onClick={() => onClick(materia)}
      className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {materia.materia_codigo}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">
            {materia.materia_nombre}
          </h3>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusColor(
            materia.tiene_final_aprobado
              ? "aprobada"
              : materia.anio_cursada_actual
                ? "cursando"
                : materia.veces_cursada > 1
                  ? "recursada"
                  : "pendiente",
          )}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-500">Veces cursada</p>
          <p className="font-semibold text-slate-800">
            {materia.veces_cursada}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Última asistencia</p>
          <p
            className={`font-semibold ${getMetricTextClass(
              "asistencia",
              materia.ultima_asistencia,
            )}`}
          >
            {formatPercent(materia.ultima_asistencia)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Promedio notas</p>
          <p
            className={`font-semibold ${getMetricTextClass(
              "promedio",
              materia.promedio_notas,
            )}`}
          >
            {formatGrade(materia.promedio_notas)}
          </p>
        </div>
      </div>
    </button>
  );
}
