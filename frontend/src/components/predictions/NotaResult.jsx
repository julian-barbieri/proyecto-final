function clampNota(value) {
  const numericValue = Number(value ?? 0);
  return Math.max(
    0,
    Math.min(10, Number.isFinite(numericValue) ? numericValue : 0),
  );
}

function getCategory(nota) {
  if (nota < 4) {
    return {
      label: "Reprobado",
      color: "text-red-700",
      border: "border-red-200",
      soft: "bg-red-50",
      bar: "bg-red-500",
    };
  }

  if (nota < 6) {
    return {
      label: "Aprobado",
      color: "text-orange-700",
      border: "border-orange-200",
      soft: "bg-orange-50",
      bar: "bg-orange-500",
    };
  }

  if (nota < 8) {
    return {
      label: "Bueno",
      color: "text-amber-700",
      border: "border-amber-200",
      soft: "bg-amber-50",
      bar: "bg-amber-500",
    };
  }

  return {
    label: "Excelente",
    color: "text-emerald-700",
    border: "border-emerald-200",
    soft: "bg-emerald-50",
    bar: "bg-emerald-500",
  };
}

const EXAM_LABELS = { Parcial: "Parcial", Recuperatorio: "Recuperatorio", Final: "Final" };

export default function NotaResult({ result }) {
  if (!result) {
    return null;
  }

  const nota = clampNota(result.Nota);
  const notaFormatted = nota.toFixed(2);
  const positionPercent = (nota / 10) * 100;
  const category = getCategory(nota);

  const nextExam = result._nextExam;
  const examLabel = nextExam
    ? `${EXAM_LABELS[nextExam.tipoExamen] ?? nextExam.tipoExamen} — Instancia ${nextExam.instancia}`
    : null;

  return (
    <section
      className={`rounded-2xl border ${category.border} ${category.soft} p-6 shadow-sm`}
    >
      {examLabel && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Predicción para: {examLabel}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">Nota predicha</p>
          <p className={`text-4xl font-bold ${category.color}`}>
            {notaFormatted}
          </p>
        </div>
        <span
          className={`rounded-full border border-white/70 bg-white/80 px-3 py-1 text-sm font-semibold ${category.color}`}
        >
          {category.label}
        </span>
      </div>

      <div className="mt-6 space-y-2">
        <div className="flex justify-between text-xs font-medium text-slate-600">
          <span>0</span>
          <span>10</span>
        </div>

        <div className="relative h-3 rounded-full bg-white/80 ring-1 ring-slate-200">
          <div className="h-full rounded-full bg-slate-200" />
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${category.bar}`}
            style={{ width: `${positionPercent}%` }}
          />
          <div
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow"
            style={{ left: `calc(${positionPercent}% - 8px)` }}
          />
        </div>
      </div>
    </section>
  );
}
