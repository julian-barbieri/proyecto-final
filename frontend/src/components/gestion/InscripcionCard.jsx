export default function InscripcionCard({
  item,
  periodoActivo,
  onInscribir,
  onBaja,
}) {
  const docentesLabel = item.docentes?.length
    ? item.docentes.join(", ")
    : "Sin docente asignado";

  let statusLabel = "✅ Disponible";
  let statusColor = "text-emerald-700";
  let borderColor = "border-emerald-200";
  let buttonLabel = "Inscribirme";
  let buttonClass = "bg-blue-600 text-white hover:bg-blue-700";
  let buttonDisabled = false;
  let action = () => onInscribir(item);

  if (item.materia_aprobada) {
    statusLabel = "🎓 Materia aprobada";
    statusColor = "text-emerald-700";
    borderColor = "border-emerald-200";
    buttonLabel = "Aprobada";
    buttonClass = "bg-slate-200 text-slate-500";
    buttonDisabled = true;
    action = undefined;
  } else if (!periodoActivo) {
    statusLabel = "⏸ Inscripciones cerradas";
    statusColor = "text-slate-600";
    borderColor = "border-slate-200";
    buttonLabel = "No disponible";
    buttonClass = "bg-slate-200 text-slate-500";
    buttonDisabled = true;
    action = undefined;
  } else if (item.ya_inscripto) {
    statusLabel = "📋 Inscripto";
    statusColor = "text-blue-700";
    borderColor = "border-blue-200";
    buttonLabel = "Dar de baja";
    buttonClass = "border border-red-200 text-red-700 hover:bg-red-50";
    action = () => onBaja(item);
  } else if (!item.disponible) {
    statusLabel = `🔒 ${item.motivo || "Bloqueada"}`;
    statusColor = "text-slate-600";
    borderColor = "border-slate-200";
    buttonLabel = "Bloqueada";
    buttonClass = "bg-slate-200 text-slate-500";
    buttonDisabled = true;
    action = undefined;
  }

  return (
    <article className={`rounded-lg border bg-white p-4 ${borderColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {item.materia_codigo}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">
            {item.materia_nombre}
          </h3>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-700">👤 Docente: {docentesLabel}</p>
      <p className={`mt-2 text-sm font-medium ${statusColor}`}>{statusLabel}</p>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={action}
          disabled={buttonDisabled}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${buttonClass} ${
            buttonDisabled ? "cursor-not-allowed" : ""
          }`}
        >
          {buttonLabel}
        </button>
      </div>
    </article>
  );
}
