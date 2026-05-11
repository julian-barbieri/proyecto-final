import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";

function examStatusClass(examen) {
  if (!examen.rendido) {
    return "bg-slate-100 text-slate-700";
  }

  if (examen.nota !== null && examen.nota >= 4) {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-red-100 text-red-700";
}

function examStatusLabel(examen) {
  if (!examen.rendido) {
    return "No rendido";
  }

  if (examen.nota !== null && examen.nota >= 4) {
    return "Aprobado";
  }

  return "Desaprobado";
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

export default function MateriaDetalle() {
  const { materiaId } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedIndex, setExpandedIndex] = useState(0);

  const loadDetail = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(`/api/mis-cursos/${materiaId}`);
      const payload = response.data;
      setDetail(payload);
      setExpandedIndex(0);
    } catch (fetchError) {
      setError(
        fetchError.message || "No se pudo cargar el detalle de la materia.",
      );
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [materiaId]);

  const materiaTitle = useMemo(() => {
    if (!detail?.materia) {
      return "Detalle de materia";
    }

    return `${detail.materia.codigo} - ${detail.materia.nombre}`;
  }, [detail]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <button
          type="button"
          onClick={() => navigate("/mis-cursos")}
          className="text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          ← Volver a Mis cursos
        </button>

        <h2 className="mt-3 text-xl font-semibold text-slate-900">
          {materiaTitle}
        </h2>
        {detail?.materia?.descripcion ? (
          <p className="mt-2 text-slate-600">{detail.materia.descripcion}</p>
        ) : null}
      </section>

      {error ? (
        <ErrorMessage message={error} onDismiss={() => setError("")} />
      ) : null}

      {loading ? (
        <LoadingSpinner size="md" text="Cargando detalle de materia..." />
      ) : null}

      {!loading && !error && detail ? (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Veces cursada
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {detail.resumen?.veces_cursada || 0}
              </p>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Promedio notas
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  detail.resumen?.promedio_notas !== null &&
                  detail.resumen?.promedio_notas !== undefined &&
                  detail.resumen.promedio_notas < 4
                    ? "text-red-600"
                    : "text-green-700"
                }`}
              >
                {formatGrade(detail.resumen?.promedio_notas)}
              </p>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Última asistencia
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  detail.resumen?.ultima_asistencia !== null &&
                  detail.resumen?.ultima_asistencia !== undefined &&
                  detail.resumen.ultima_asistencia < 0.7
                    ? "text-red-600"
                    : "text-green-700"
                }`}
              >
                {formatPercent(detail.resumen?.ultima_asistencia)}
              </p>
            </article>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">
              Historial por año
            </h3>

            {Array.isArray(detail.cursadas) && detail.cursadas.length > 0 ? (
              detail.cursadas.map((cursada, index) => {
                const isExpanded = expandedIndex === index;

                return (
                  <article
                    key={`${cursada.anio}-${index}`}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <div>
                        <p className="text-sm text-slate-500">Año</p>
                        <p className="text-base font-semibold text-slate-900">
                          {cursada.anio}
                        </p>
                      </div>

                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className={`h-5 w-5 text-slate-500 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 9l6 6 6-6"
                        />
                      </svg>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-slate-100 px-4 py-3">
                        <div className="mb-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-slate-500">
                              Estado cursada
                            </p>
                            <p className="font-medium capitalize text-slate-800">
                              {cursada.estado}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Asistencia</p>
                            <p
                              className={`font-medium ${
                                cursada.asistencia !== null &&
                                cursada.asistencia < 0.7
                                  ? "text-red-600"
                                  : "text-slate-800"
                              }`}
                            >
                              {formatPercent(cursada.asistencia)}
                            </p>
                          </div>
                        </div>

                        {Array.isArray(cursada.examenes) &&
                        cursada.examenes.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-sm">
                              <thead>
                                <tr className="bg-slate-50 text-left text-slate-600">
                                  <th className="px-3 py-2 font-medium">
                                    Tipo
                                  </th>
                                  <th className="px-3 py-2 font-medium">
                                    Instancia
                                  </th>
                                  <th className="px-3 py-2 font-medium">
                                    Nota
                                  </th>
                                  <th className="px-3 py-2 font-medium">
                                    Estado
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {cursada.examenes.map((examen, examIndex) => (
                                  <tr
                                    key={`${examen.tipo}-${examen.instancia}-${examIndex}`}
                                  >
                                    <td className="border-t border-slate-100 px-3 py-2">
                                      {examen.tipo}
                                    </td>
                                    <td className="border-t border-slate-100 px-3 py-2">
                                      {examen.instancia}
                                    </td>
                                    <td className="border-t border-slate-100 px-3 py-2">
                                      {examen.nota === null ||
                                      examen.nota === undefined
                                        ? "—"
                                        : Number(examen.nota).toFixed(1)}
                                    </td>
                                    <td className="border-t border-slate-100 px-3 py-2">
                                      <span
                                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${examStatusClass(
                                          examen,
                                        )}`}
                                      >
                                        {examStatusLabel(examen)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <EmptyState
                            icon="🧪"
                            title="Sin exámenes registrados"
                            description="Todavía no hay instancias cargadas para este año de cursada."
                          />
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <EmptyState
                icon="📭"
                title="Sin historial disponible"
                description="No hay registros de cursada para esta materia."
              />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
