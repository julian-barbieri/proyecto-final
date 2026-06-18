function clampProbability(value) {
  const numericValue = Number(value ?? 0);
  return Math.max(
    0,
    Math.min(1, Number.isFinite(numericValue) ? numericValue : 0),
  );
}

function getRiskBand(probability) {
  if (probability >= 0.7) {
    return {
      border: "border-red-200",
      accent: "text-red-700",
      soft: "bg-red-50",
      badge: "bg-red-100 text-red-700",
      title: "RIESGO ALTO DE RECURSADO",
      subtitle: "El modelo estima alta probabilidad de que el alumno recurse esta materia.",
      icon: "alert",
    };
  }
  if (probability >= 0.4) {
    return {
      border: "border-amber-200",
      accent: "text-amber-700",
      soft: "bg-amber-50",
      badge: "bg-amber-100 text-amber-700",
      title: "RIESGO MODERADO DE RECURSADO",
      subtitle: "El modelo detecta algunas señales de riesgo de recursado. Se recomienda seguimiento.",
      icon: "warning",
    };
  }
  return {
    border: "border-emerald-200",
    accent: "text-emerald-700",
    soft: "bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-700",
    title: "RIESGO BAJO DE RECURSADO",
    subtitle: "El modelo estima que el alumno tiene buenas chances de aprobar sin recursar.",
    icon: "check",
  };
}

export default function RecursadoResult({ result }) {
  if (!result) {
    return null;
  }

  const probability = clampProbability(result.probabilidad);
  const percentage = (probability * 100).toFixed(1);
  const band = getRiskBand(probability);

  return (
    <section
      className={`rounded-2xl border ${band.border} ${band.soft} p-6 shadow-sm`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
          <svg
            viewBox="0 0 24 24"
            className={`h-6 w-6 ${band.accent}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            {band.icon === "alert" ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.67 18h16.66a1 1 0 00.88-1.48l-7.5-13a1 1 0 00-1.76 0z"
              />
            ) : band.icon === "warning" ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
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
          <p className={`text-sm font-semibold tracking-wide ${band.accent}`}>
            {band.title}
          </p>
          <p className="mt-1 text-sm text-slate-700">{band.subtitle}</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between text-sm font-medium text-slate-700">
          <span>Probabilidad estimada de recursado</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${band.badge}`}>
            {percentage}%
          </span>
        </div>

        <div className="relative h-4 overflow-hidden rounded-full bg-white/80 ring-1 ring-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
          <div className="absolute inset-y-0 left-[40%] w-px bg-white/60" title="40%" />
          <div className="absolute inset-y-0 left-[70%] w-px bg-white/60" title="70%" />
        </div>

        <div className="flex justify-between text-xs text-slate-400">
          <span>Bajo &lt;40%</span>
          <span>Moderado 40–70%</span>
          <span>Alto &gt;70%</span>
        </div>
      </div>
    </section>
  );
}
