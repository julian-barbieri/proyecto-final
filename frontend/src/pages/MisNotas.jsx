import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";

function estadoNota(examen) {
  if (
    Number(examen.rendido) !== 1 ||
    examen.nota === null ||
    examen.nota === undefined
  ) {
    return { label: "○ Ausente", tone: "text-slate-600" };
  }

  if (Number(examen.nota) >= 4) {
    return { label: "✅ Aprobado", tone: "text-emerald-700" };
  }

  return { label: "❌ Reprobado", tone: "text-red-700" };
}

export default function MisNotas() {
  const [materias, setMaterias] = useState([]);
  const [selectedMateriaId, setSelectedMateriaId] = useState(null);
  const [detalleMateria, setDetalleMateria] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/api/mis-cursos");
        const all = [
          ...(response.data?.cursando || []),
          ...(response.data?.finalesPendientes || []),
          ...(response.data?.aprobadas || []),
          ...(response.data?.recursadas || []),
        ];

        const uniqueMap = new Map();
        for (const item of all) {
          if (!uniqueMap.has(item.materia_id)) {
            uniqueMap.set(item.materia_id, item);
          }
        }

        const list = Array.from(uniqueMap.values());
        setMaterias(list);

        if (list.length > 0) {
          setSelectedMateriaId(list[0].materia_id);

          const details = await Promise.all(
            list.map(async (materia) => {
              const detailResponse = await api.get(
                `/api/mis-cursos/${materia.materia_id}`,
              );
              return [materia.materia_id, detailResponse.data];
            }),
          );

          setDetalleMateria(Object.fromEntries(details));
        }
      } catch (fetchError) {
        setError(fetchError.message || "No se pudieron cargar tus notas.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const materiaActual = useMemo(() => {
    if (!selectedMateriaId) {
      return null;
    }
    return detalleMateria[selectedMateriaId] || null;
  }, [selectedMateriaId, detalleMateria]);

  const cursadas = materiaActual?.cursadas || [];
  const promedioGeneral = useMemo(() => {
    const notas = [];

    for (const cursada of cursadas) {
      for (const examen of cursada.examenes || []) {
        if (
          Number(examen.rendido) === 1 &&
          examen.nota !== null &&
          examen.nota !== undefined
        ) {
          notas.push(Number(examen.nota));
        }
      }
    }

    if (!notas.length) {
      return null;
    }

    return notas.reduce((sum, value) => sum + value, 0) / notas.length;
  }, [cursadas]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Mis notas</h2>
        <p className="mt-2 text-slate-600">
          Revisá el detalle de calificaciones por materia y por año de cursada.
        </p>
      </section>

      {error ? (
        <ErrorMessage message={error} onDismiss={() => setError("")} />
      ) : null}
      {loading ? (
        <LoadingSpinner size="md" text="Cargando tus notas..." />
      ) : null}

      {!loading && !error && materias.length === 0 ? (
        <EmptyState
          icon="📚"
          title="Todavía no hay notas registradas"
          description="Cuando tengas exámenes cargados en el sistema, aparecerán acá."
        />
      ) : null}

      {!loading && !error && materias.length > 0 ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-2 sm:p-4">
            <div
              className="-mx-1 flex gap-2 overflow-x-auto px-1"
              role="tablist"
            >
              {materias.map((materia) => (
                <button
                  key={materia.materia_id}
                  type="button"
                  onClick={() => setSelectedMateriaId(materia.materia_id)}
                  className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition ${
                    selectedMateriaId === materia.materia_id
                      ? "bg-blue-100 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {materia.materia_codigo} - {materia.materia_nombre}
                </button>
              ))}
            </div>
          </section>

          {cursadas.map((cursada) => {
            const notasCursada = (cursada.examenes || [])
              .filter(
                (examen) =>
                  Number(examen.rendido) === 1 &&
                  examen.nota !== null &&
                  examen.nota !== undefined,
              )
              .map((examen) => Number(examen.nota));

            const promedioCursada =
              notasCursada.length > 0
                ? notasCursada.reduce((sum, value) => sum + value, 0) /
                  notasCursada.length
                : null;

            return (
              <section
                key={`${selectedMateriaId}-${cursada.anio}`}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-900">
                    {cursada.anio} — {cursada.estado}
                  </h3>
                  {promedioCursada !== null ? (
                    <span className="text-sm font-medium text-slate-700">
                      Promedio cursada: {promedioCursada.toFixed(2)}
                    </span>
                  ) : null}
                </div>

                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">Inst</th>
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-left">Nota</th>
                        <th className="px-3 py-2 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cursada.examenes || []).map((examen, index) => {
                        const estado = estadoNota(examen);
                        return (
                          <tr
                            key={`${cursada.anio}-${examen.tipo}-${examen.instancia}-${index}`}
                            className="border-t border-slate-100"
                          >
                            <td className="px-3 py-2">{examen.tipo}</td>
                            <td className="px-3 py-2">{examen.instancia}</td>
                            <td className="px-3 py-2">
                              {examen.fecha_examen || "—"}
                            </td>
                            <td className="px-3 py-2">
                              {examen.nota !== null && examen.nota !== undefined
                                ? Number(examen.nota).toFixed(2)
                                : "—"}
                            </td>
                            <td className={`px-3 py-2 ${estado.tone}`}>
                              {estado.label}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          {promedioGeneral !== null ? (
            <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
              Promedio general: <strong>{promedioGeneral.toFixed(2)}</strong>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
