import { useEffect } from "react";
import GraficoRendimientoMateria from "./GraficoRendimientoMateria";
import GraficoHistoricoExamen from "./GraficoHistoricoExamen";

function SkeletonLoader() {
  return (
    <div className="space-y-8">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse bg-white border border-gray-100 rounded-xl p-5"
        >
          <div className="h-4 bg-gray-200 rounded w-48 mb-6" />
          <div className="h-64 bg-gray-100 rounded-lg" />
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-8 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SeccionRendimiento({
  data,
  loading,
  anio,
  aniosDisponibles,
  onAnioChange,
  materiaSeleccionada,
  onMateriaChange,
}) {
  // Extraer materias disponibles del data
  const materiasDisponibles = (data || []).map((m) => ({
    id: m.materia_id,
    codigo: m.materia_codigo,
    nombre: m.materia_nombre,
  }));

  // Auto-seleccionar primera materia si no hay seleccionada
  useEffect(() => {
    if (materiaSeleccionada === null && materiasDisponibles.length > 0 && !loading) {
      onMateriaChange(materiasDisponibles[0].id);
    }
  }, [materiaSeleccionada, materiasDisponibles.length, loading]);

  // Filtrar data según materia seleccionada
  const dataFiltrada =
    materiaSeleccionada && data
      ? data.filter((m) => m.materia_id === materiaSeleccionada)
      : data;

  if (loading) return <SkeletonLoader />;

  return (
    <div>
      {/* Selectores de año y materia */}
      <div className="flex items-center gap-6 mb-6 flex-wrap">
        {/* Selector de año */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600">
            Año académico:
          </label>
          <select
            value={anio}
            onChange={(e) => onAnioChange(parseInt(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {aniosDisponibles.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Selector de materia */}
        {materiasDisponibles.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600">
              Materia:
            </label>
            <select
              value={materiaSeleccionada || ""}
              onChange={(e) => onMateriaChange(parseInt(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {materiasDisponibles.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigo} - {m.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {dataFiltrada && dataFiltrada.length > 0 && (
          <span className="text-sm text-gray-400 ml-auto">
            {anio} • {dataFiltrada[0]?.materia_codigo}
          </span>
        )}
      </div>

      {/* Sin datos */}
      {!dataFiltrada || dataFiltrada.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Sin datos disponibles</p>
          <p className="text-sm mt-1">
            No hay exámenes registrados para esa combinación de año y materia.
          </p>
        </div>
      ) : (
        /* Un gráfico por materia filtrada */
        <div className="space-y-8">
          {dataFiltrada.map((materia) => (
            <div key={materia.materia_id}>
              <GraficoRendimientoMateria materia={materia} />
              <GraficoHistoricoExamen materiaId={materia.materia_id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
