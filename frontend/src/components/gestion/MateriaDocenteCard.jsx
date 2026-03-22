export default function MateriaDocenteCard({ item }) {
  const isActive = Number(item.activo) === 1;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {item.materia_codigo}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">
            {item.materia_nombre}
          </h3>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            isActive
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {isActive ? "Activo" : "Historial"}
        </span>
      </div>

      <div className="mt-3 space-y-1 text-sm text-slate-700">
        <p>📅 Año {item.anio}</p>
        <p>👥 {Number(item.cantidad_alumnos || 0)} alumnos</p>
      </div>
    </article>
  );
}
