import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import LoadingSpinner from "../components/LoadingSpinner";

function formatDate(value) {
  if (!value) return "—";

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [day, month, year] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  return value;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return `${Math.round(Number(value) * 100)}%`;
}

function formatRatioPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "0%";
  }
  return `${Math.round(Number(value) * 100)}%`;
}

function formatNota(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return Number(value).toFixed(2);
}

function getBadgeByAttempts(veces) {
  const count = Number(veces || 0);
  if (count <= 1) return "1ra vez";
  if (count === 2) return "2da vez";
  return "3ra vez";
}

function getAssistanceSignal(asistencia) {
  const value = Number(asistencia || 0);

  if (value < 0.75) {
    return {
      dotClass: "bg-orange-500",
      label: "Asistencia baja",
      icon: "⚠",
    };
  }

  if (value < 0.8) {
    return {
      dotClass: "bg-yellow-500",
      label: "Asistencia media",
      icon: "•",
    };
  }

  return {
    dotClass: "bg-green-500",
    label: "Asistencia estable",
    icon: "•",
  };
}

function expectedExamSlots(cursada) {
  if (cursada.materia_codigo !== "AM1") {
    return [];
  }

  const anio = Number(cursada.anio);

  return [
    { tipo: "Parcial", instancia: 1, fecha_examen: `15-06-${anio}` },
    { tipo: "Recuperatorio", instancia: 1, fecha_examen: `23-06-${anio}` },
    { tipo: "Parcial", instancia: 2, fecha_examen: `09-11-${anio}` },
    { tipo: "Recuperatorio", instancia: 2, fecha_examen: `23-11-${anio}` },
    { tipo: "Final", instancia: 1, fecha_examen: `14-12-${anio}` },
    { tipo: "Final", instancia: 2, fecha_examen: `09-02-${anio + 1}` },
    { tipo: "Final", instancia: 3, fecha_examen: `13-07-${anio + 1}` },
  ];
}

function getExamStatus(exam) {
  if (!exam) {
    return {
      text: "⏳ Pendiente",
      className: "text-slate-500",
      nota: "—",
      fecha: "—",
    };
  }

  if (Number(exam.rendido) === 0 && Number(exam.ausente) === 1) {
    return {
      text: "○ Ausente",
      className: "text-slate-500",
      nota: "—",
      fecha: formatDate(exam.fecha_examen),
    };
  }

  if (Number(exam.rendido) === 1 && Number(exam.nota) >= 4) {
    return {
      text: "✅ Aprobado",
      className: "text-emerald-700",
      nota: formatNota(exam.nota),
      fecha: formatDate(exam.fecha_examen),
    };
  }

  if (Number(exam.rendido) === 1 && Number(exam.nota) < 4) {
    return {
      text: "❌ Desaprobado",
      className: "text-red-700",
      nota: formatNota(exam.nota),
      fecha: formatDate(exam.fecha_examen),
    };
  }

  return {
    text: "⏳ Pendiente",
    className: "text-slate-500",
    nota: "—",
    fecha: exam.fecha_examen ? formatDate(exam.fecha_examen) : "—",
  };
}

function buildExamRows(cursada) {
  const existing = new Map(
    (cursada.examenes || []).map((exam) => [
      `${exam.tipo}-${exam.instancia}`,
      exam,
    ]),
  );

  const expected = expectedExamSlots(cursada);

  if (!expected.length) {
    return (cursada.examenes || []).map((exam) => ({
      key: `${exam.tipo}-${exam.instancia}`,
      tipo: exam.tipo,
      instancia: exam.instancia,
      exam,
      fallbackFecha: exam.fecha_examen,
    }));
  }

  return expected.map((slot) => ({
    key: `${slot.tipo}-${slot.instancia}`,
    tipo: slot.tipo,
    instancia: slot.instancia,
    exam: existing.get(`${slot.tipo}-${slot.instancia}`) || null,
    fallbackFecha: slot.fecha_examen,
  }));
}

function EstadoChip({ estado }) {
  const styles = {
    cursando: "bg-blue-100 text-blue-700",
    aprobada: "bg-emerald-100 text-emerald-700",
    recursada: "bg-orange-100 text-orange-700",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[estado] || "bg-slate-100 text-slate-700"
      }`}
    >
      {estado}
    </span>
  );
}

function AlumnoFila({ alumno, onViewDetail }) {
  const assistance = getAssistanceSignal(alumno.ultima_asistencia);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">
          {alumno.nombre_completo}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">
            {getBadgeByAttempts(alumno.veces_cursada)}
          </span>
          <span>Asist: {formatPercent(alumno.ultima_asistencia)}</span>
          <span className="inline-flex items-center gap-1">
            <span
              className={`inline-block h-2 w-2 rounded-full ${assistance.dotClass}`}
            />
            <span>{assistance.icon}</span>
            <span>{assistance.label}</span>
          </span>
          {alumno.promedio_nota !== null &&
          alumno.promedio_nota !== undefined ? (
            <span>Prom: {formatNota(alumno.promedio_nota)}</span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onViewDetail(alumno.id)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Ver detalle →
      </button>
    </article>
  );
}

export default function GestionAlumnos() {
  const [materias, setMaterias] = useState([]);
  const [materiaActiva, setMateriaActiva] = useState(null);
  const [datos, setDatos] = useState(null);
  const [alumnoDetalle, setAlumnoDetalle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadMaterias = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/api/gestion-alumnos/materias");
        if (!active) return;

        const materiasData = response.data || [];
        setMaterias(materiasData);

        if (materiasData.length > 0) {
          await cargarAlumnos(materiasData[0].id, materiasData);
        }
      } catch (fetchError) {
        if (active) {
          setError(
            fetchError.message || "No se pudo cargar gestión de alumnos.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadMaterias();

    return () => {
      active = false;
    };
  }, []);

  const cargarAlumnos = async (materiaId, materiasRef = materias) => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(
        `/api/gestion-alumnos/materias/${materiaId}/alumnos`,
      );
      setDatos(response.data);

      const selected = (materiasRef || []).find(
        (m) => Number(m.id) === Number(materiaId),
      );
      setMateriaActiva(selected || response.data?.materia || null);
    } catch (fetchError) {
      setError(
        fetchError.message ||
          "No se pudieron cargar los alumnos de la materia.",
      );
    } finally {
      setLoading(false);
    }
  };

  const cargarDetalle = async (alumnoId) => {
    setLoadingDetalle(true);
    setError("");

    try {
      const response = await api.get(
        `/api/gestion-alumnos/alumnos/${alumnoId}`,
      );
      setAlumnoDetalle(response.data);
    } catch (fetchError) {
      setError(
        fetchError.message || "No se pudo cargar el detalle del alumno.",
      );
    } finally {
      setLoadingDetalle(false);
    }
  };

  const groupedByMateria = useMemo(() => {
    const cursadas = alumnoDetalle?.cursadas || [];
    const map = new Map();

    for (const cursada of cursadas) {
      const key = cursada.materia_codigo;
      if (!map.has(key)) {
        map.set(key, {
          codigo: cursada.materia_codigo,
          nombre: cursada.materia_nombre,
          cursadas: [],
        });
      }
      map.get(key).cursadas.push(cursada);
    }

    return Array.from(map.values()).map((materia) => ({
      ...materia,
      cursadas: materia.cursadas.sort(
        (a, b) => Number(b.anio) - Number(a.anio),
      ),
    }));
  }, [alumnoDetalle]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Gestión de alumnos
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Seleccioná una materia para ver alumnos cursando, recursados o con
          final pendiente.
        </p>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2">
        {materias.map((materia) => (
          <button
            key={materia.id}
            type="button"
            onClick={() => cargarAlumnos(materia.id)}
            className={`flex w-full flex-col items-center rounded-xl border-2 p-6 text-center transition-all ${
              Number(materiaActiva?.id) === Number(materia.id)
                ? "border-blue-500 bg-blue-50 text-blue-800"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <span className="text-lg font-medium">{materia.nombre}</span>
            <span className="mt-1 text-sm text-gray-500">
              {materia.total_relevantes} alumnos
            </span>
          </button>
        ))}
      </section>

      {loading ? (
        <LoadingSpinner size="md" text="Cargando alumnos..." />
      ) : datos?.materia ? (
        <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {datos.materia.nombre}
          </h3>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              📚 Cursando ({datos.cursando?.length || 0})
            </p>
            {(datos.cursando || []).length === 0 ? (
              <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
                Sin alumnos en esta categoría.
              </p>
            ) : (
              <div className="space-y-2">
                {datos.cursando.map((alumno) => (
                  <AlumnoFila
                    key={`c-${alumno.id}`}
                    alumno={alumno}
                    onViewDetail={cargarDetalle}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              🔁 Recursaron sin aprobar (
              {datos.recursado_sin_aprobar?.length || 0})
            </p>
            {(datos.recursado_sin_aprobar || []).length === 0 ? (
              <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
                Sin alumnos en esta categoría.
              </p>
            ) : (
              <div className="space-y-2">
                {datos.recursado_sin_aprobar.map((alumno) => (
                  <AlumnoFila
                    key={`r-${alumno.id}`}
                    alumno={alumno}
                    onViewDetail={cargarDetalle}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              ⏳ Final pendiente ({datos.final_pendiente?.length || 0})
            </p>
            {(datos.final_pendiente || []).length === 0 ? (
              <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
                Sin alumnos en esta categoría.
              </p>
            ) : (
              <div className="space-y-2">
                {datos.final_pendiente.map((alumno) => (
                  <AlumnoFila
                    key={`f-${alumno.id}`}
                    alumno={alumno}
                    onViewDetail={cargarDetalle}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-200 ${
          alumnoDetalle ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setAlumnoDetalle(null)}
      />

      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-full overflow-y-auto bg-white shadow-xl transition-transform duration-300 md:w-[40%] md:max-w-none ${
          alumnoDetalle ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {loadingDetalle ? (
          <div className="p-8">
            <LoadingSpinner size="md" text="Cargando detalle..." />
          </div>
        ) : alumnoDetalle ? (
          <div className="space-y-5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {alumnoDetalle.alumno.nombre_completo}
                </h3>
                <p className="text-sm text-slate-600">
                  {alumnoDetalle.alumno.email || "Sin email"}
                </p>
                <p className="text-sm text-slate-500">
                  {alumnoDetalle.alumno.genero || "—"} · Nac:{" "}
                  {formatDate(alumnoDetalle.alumno.fecha_nac)}
                </p>
                <p className="text-sm text-slate-500">
                  Ingreso: {alumnoDetalle.alumno.anio_ingreso || "—"} · Prom.
                  colegio: {formatNota(alumnoDetalle.alumno.promedio_colegio)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlumnoDetalle(null)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">
                  Total materias cursadas
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {alumnoDetalle.resumen.cant_materias}
                </p>
              </article>
              <article className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Promedio de notas</p>
                <p className="text-lg font-semibold text-slate-900">
                  {Number(alumnoDetalle.resumen.promedio_nota) > 0
                    ? formatNota(alumnoDetalle.resumen.promedio_nota)
                    : "Sin notas"}
                </p>
              </article>
              <article className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Tasa de aprobación</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatRatioPercent(alumnoDetalle.resumen.tasa_aprobacion)}
                </p>
              </article>
              <article className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Promedio de asistencia</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatRatioPercent(
                    alumnoDetalle.resumen.promedio_asistencia,
                  )}
                </p>
              </article>
            </section>

            <section className="space-y-4">
              {groupedByMateria.map((materia) => (
                <div key={materia.codigo} className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-800">
                    {materia.codigo} · {materia.nombre}
                  </h4>

                  {materia.cursadas.map((cursada, index) => {
                    const examRows = buildExamRows(cursada);

                    return (
                      <details
                        key={`${cursada.materia_codigo}-${cursada.anio}-${index}`}
                        open={index === 0}
                        className="rounded-lg border border-slate-200"
                      >
                        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cursada.anio}</span>
                            <EstadoChip estado={cursada.estado} />
                          </div>
                          <span className="text-xs text-slate-600">
                            Asistencia: {formatPercent(cursada.asistencia)}{" "}
                            {Number(cursada.asistencia) < 0.75 ? "⚠" : ""}
                          </span>
                        </summary>

                        <div className="overflow-x-auto border-t border-slate-200 px-4 py-3">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs uppercase text-slate-500">
                                <th className="pb-2 pr-3">Tipo</th>
                                <th className="pb-2 pr-3">Instancia</th>
                                <th className="pb-2 pr-3">Fecha</th>
                                <th className="pb-2 pr-3">Nota</th>
                                <th className="pb-2">Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {examRows.map((row) => {
                                const status = getExamStatus(row.exam);

                                return (
                                  <tr
                                    key={row.key}
                                    className="border-t border-slate-100 text-slate-700"
                                  >
                                    <td className="py-2 pr-3">{row.tipo}</td>
                                    <td className="py-2 pr-3">
                                      {row.instancia}
                                    </td>
                                    <td className="py-2 pr-3">
                                      {row.exam
                                        ? status.fecha
                                        : row.fallbackFecha
                                          ? formatDate(row.fallbackFecha)
                                          : "—"}
                                    </td>
                                    <td className="py-2 pr-3">{status.nota}</td>
                                    <td
                                      className={`py-2 font-medium ${status.className}`}
                                    >
                                      {status.text}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    );
                  })}
                </div>
              ))}
            </section>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
