import { Calendar, Users } from "lucide-react";

export default function MateriaDocenteCard({ item }) {
  const isActive = Number(item.activo) === 1;

  return (
    <article className="rounded-lg border border-surface-border bg-white p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* Código de materia en monospace — tipografía técnica para códigos */}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 font-mono">
            {item.materia_codigo}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-900 leading-snug">
            {item.materia_nombre}
          </h3>
        </div>
        {/* badge de estado: brand para activo, neutro para historial */}
        <span
          className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isActive
              ? "bg-brand-50 text-brand-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {isActive ? "Activo" : "Historial"}
        </span>
      </div>

      {/* Metadatos con íconos SVG — sin emojis */}
      <div className="mt-3 flex items-center gap-4 text-sm text-slate-600">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
          Año {item.anio}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
          {Number(item.cantidad_alumnos || 0)} alumnos
        </span>
      </div>
    </article>
  );
}
