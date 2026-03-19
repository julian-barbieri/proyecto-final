function clampProbability(value) {
  const numericValue = Number(value ?? 0);
  return Math.max(
    0,
    Math.min(1, Number.isFinite(numericValue) ? numericValue : 0),
  );
}

function getStatusContent(abandona) {
  if (abandona) {
    return {
      border: "border-red-200",
      accent: "text-red-700",
      soft: "bg-red-50",
      title: "RIESGO DE ABANDONO",
      subtitle:
        "El modelo predice que este alumno podría abandonar la carrera.",
    };
  }

  return {
    border: "border-emerald-200",
    accent: "text-emerald-700",
    soft: "bg-emerald-50",
    title: "SIN RIESGO DE ABANDONO",
    subtitle:
      "El modelo no detecta señales de abandono relevantes para este alumno.",
  };
}

export default function AbandonoResult({ result }) {
  if (!result) {
    return null;
  }

  const probability = clampProbability(result.probabilidad);
  const percentage = (probability * 100).toFixed(1);
  const status = getStatusContent(Boolean(result.Abandona));

  return (
    <section
      className={`rounded-2xl border ${status.border} ${status.soft} p-6 shadow-sm`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
          <svg
            viewBox="0 0 24 24"
            className={`h-6 w-6 ${status.accent}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            {result.Abandona ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.67 18h16.66a1 1 0 00.88-1.48l-7.5-13a1 1 0 00-1.76 0z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            )}
          </svg>
        </div>

        <div className="flex-1">
          <p className={`text-sm font-semibold tracking-wide ${status.accent}`}>
            {status.title}
          </p>
          <p className="mt-1 text-sm text-slate-700">{status.subtitle}</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between text-sm font-medium text-slate-700">
          <span>Probabilidad estimada de abandono</span>
          <span>{percentage}%</span>
        </div>

        <div className="h-4 overflow-hidden rounded-full bg-white/80 ring-1 ring-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <p className="text-sm text-slate-600">
          Probabilidad estimada de abandono: {percentage}%
        </p>
      </div>
    </section>
  );
}
