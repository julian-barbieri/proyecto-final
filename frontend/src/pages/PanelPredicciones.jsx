import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axios";
import LoadingSpinner from "../components/LoadingSpinner";

// Helpers
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

function RiskBadge({ risk, label }) {
  if (!risk) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
        ⚪ Sin datos
      </span>
    );
  }

  const colors = {
    red: "bg-red-100 text-red-700",
    yellow: "bg-yellow-100 text-yellow-700",
    orange: "bg-orange-100 text-orange-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-green-100 text-green-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
        colors[risk.color] || colors.green
      }`}
    >
      {risk.icon} {label || risk.label}
    </span>
  );
}

function AlumnoFila({ alumno, onViewDetail }) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header mejorado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-900 truncate">
            {alumno.nombre_completo}
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => onViewDetail(alumno.id)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            Ver detalles →
          </button>
        </div>
      </div>

      {/* Separador sutil */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Predicciones Grid - Mejoradas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Cargando predicciones */}
        {!alumno.prediccion && (
          <div className="col-span-3 flex items-center gap-2 text-xs text-slate-500 italic">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            Calculando predicciones...
          </div>
        )}

        {/* ABANDONO */}
        {alumno.prediccion?.abandono && (
          <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-100/50 p-2 hover:shadow-sm transition-shadow">
            {alumno.prediccion.abandono.probabilidad !== null &&
            alumno.prediccion.abandono.probabilidad !== undefined ? (
              <div className="space-y-1">
                <div>
                  <p className="text-xl font-bold text-slate-900">
                    {formatPercent(alumno.prediccion.abandono.probabilidad)}
                  </p>
                  <p className="text-sm font-semibold text-slate-700">
                    Abandono
                  </p>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      alumno.prediccion.abandono.probabilidad > 0.7
                        ? "bg-red-500"
                        : alumno.prediccion.abandono.probabilidad > 0.5
                          ? "bg-amber-500"
                          : "bg-green-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        alumno.prediccion.abandono.probabilidad * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">
                {alumno.prediccion.abandono.error || "No disponible"}
              </p>
            )}
          </div>
        )}

        {/* RECURSADO */}
        {alumno.prediccion?.recursado && (
          <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-100/50 p-2 hover:shadow-sm transition-shadow">
            {alumno.prediccion.recursado.probabilidad !== null &&
            alumno.prediccion.recursado.probabilidad !== undefined ? (
              <div className="space-y-1">
                <div>
                  <p className="text-xl font-bold text-slate-900">
                    {formatPercent(alumno.prediccion.recursado.probabilidad)}
                  </p>
                  <p className="text-sm font-semibold text-slate-700">
                    Recursado
                  </p>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      alumno.prediccion.recursado.probabilidad > 0.7
                        ? "bg-red-500"
                        : alumno.prediccion.recursado.probabilidad > 0.5
                          ? "bg-amber-500"
                          : "bg-green-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        alumno.prediccion.recursado.probabilidad * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">
                {alumno.prediccion.recursado.error || "No disponible"}
              </p>
            )}
          </div>
        )}

        {/* NOTA PRÓXIMA */}
        {alumno.prediccion?.nota && (
          <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-100/50 p-2 hover:shadow-sm transition-shadow">
            {alumno.prediccion.nota.nota !== null &&
            alumno.prediccion.nota.nota !== undefined ? (
              <div className="space-y-1">
                <div>
                  <p className="text-xl font-bold text-slate-900">
                    {formatNota(alumno.prediccion.nota.nota)}
                  </p>
                  <p className="text-sm font-semibold text-slate-700">
                    Próxima Nota
                  </p>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      alumno.prediccion.nota.nota >= 8
                        ? "bg-green-500"
                        : alumno.prediccion.nota.nota >= 6
                          ? "bg-blue-500"
                          : alumno.prediccion.nota.nota >= 4
                            ? "bg-amber-500"
                            : "bg-red-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        (alumno.prediccion.nota.nota / 10) * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 italic">
                {alumno.prediccion.nota.error || "No disponible"}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function DetallePanel({ alumno, alumnoData, onClose, loading, materiaActiva }) {
  const [activeTab, setActiveTab] = useState("resumen");

  const groupedByMateria = useMemo(() => {
    const cursadas = alumnoData?.cursadas || [];
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
  }, [alumnoData]);

  if (loading) {
    return (
      <div className="p-8">
        <LoadingSpinner size="md" text="Cargando..." />
      </div>
    );
  }

  if (!alumnoData) {
    return null;
  }

  return (
    <div className="space-y-5 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">
            {alumnoData.alumno.nombre_completo}
          </h3>
          <p className="text-sm text-slate-600">
            {alumnoData.alumno.email || "Sin email"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4">
          {["resumen", "historial", "predicciones"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab === "resumen" && "📊 Resumen"}
              {tab === "historial" && "📜 Historial"}
              {tab === "predicciones" && "🔮 Predicciones"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === "resumen" && (
          <div className="space-y-4">
            <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Total materias</p>
                <p className="text-lg font-semibold text-slate-900">
                  {alumnoData.resumen.cant_materias}
                </p>
              </article>
              <article className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Promedio</p>
                <p className="text-lg font-semibold text-slate-900">
                  {Number(alumnoData.resumen.promedio_nota) > 0
                    ? formatNota(alumnoData.resumen.promedio_nota)
                    : "—"}
                </p>
              </article>
              <article className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Aprobación</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatRatioPercent(alumnoData.resumen.tasa_aprobacion)}
                </p>
              </article>
              <article className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Asistencia</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatRatioPercent(alumnoData.resumen.promedio_asistencia)}
                </p>
              </article>
            </section>

            {/* Información de la materia actual */}
            {alumno && (
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-800 border-b pb-2">
                  Información de {materiaActiva?.nombre || "la materia"}
                </h4>
                <div className="grid gap-2 sm:grid-cols-3">
                  <article className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Veces cursada</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {getBadgeByAttempts(alumno.veces_cursada)}
                    </p>
                  </article>
                  <article className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Asistencia</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatPercent(alumno.ultima_asistencia)}
                    </p>
                  </article>
                  <article className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Promedio de notas</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {alumno.promedio_nota
                        ? formatNota(alumno.promedio_nota)
                        : "—"}
                    </p>
                  </article>
                </div>
              </section>
            )}

            {alumno.prediccion && (
              <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">
                  🎯 Predicción de Abandono de Carrera
                </h4>
                {alumno.prediccion.abandono ? (
                  <div className="space-y-2">
                    <RiskBadge risk={alumno.prediccion.abandono.risk} />
                    {alumno.prediccion.abandono.probabilidad !== null && (
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Probabilidad:</span>
                          <span className="font-semibold text-slate-900">
                            {formatPercent(
                              alumno.prediccion.abandono.probabilidad,
                            )}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              alumno.prediccion.abandono.probabilidad > 0.7
                                ? "bg-red-500"
                                : alumno.prediccion.abandono.probabilidad > 0.5
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                            }`}
                            style={{
                              width: `${Math.min(
                                alumno.prediccion.abandono.probabilidad * 100,
                                100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    No hay predicción disponible
                  </p>
                )}
              </section>
            )}
          </div>
        )}

        {activeTab === "historial" && (
          <section className="space-y-4">
            {groupedByMateria.length === 0 ? (
              <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
                Sin historial de exámenes
              </p>
            ) : (
              groupedByMateria.map((materia) => (
                <div key={materia.codigo} className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-800">
                    {materia.codigo} · {materia.nombre}
                  </h4>
                  {materia.cursadas.map((cursada, idx) => (
                    <details
                      key={`${cursada.materia_codigo}-${cursada.anio}-${idx}`}
                      open={idx === 0}
                      className="rounded-lg border border-slate-200"
                    >
                      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm text-slate-800">
                        <span>{cursada.anio}</span>
                        <span className="text-xs text-slate-500">
                          Asist: {formatPercent(cursada.asistencia)}
                        </span>
                      </summary>
                      <div className="overflow-x-auto border-t border-slate-200 px-4 py-3">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="text-left text-xs uppercase text-slate-500">
                              <th className="pb-2 pr-2">Tipo</th>
                              <th className="pb-2 pr-2">Inst</th>
                              <th className="pb-2 pr-2">Fecha</th>
                              <th className="pb-2 pr-2">Nota</th>
                              <th className="pb-2">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(cursada.examenes || []).map((exam) => (
                              <tr
                                key={`${exam.tipo}-${exam.instancia}`}
                                className="border-t border-slate-100"
                              >
                                <td className="py-2 pr-2 text-slate-700">
                                  {exam.tipo}
                                </td>
                                <td className="py-2 pr-2 text-slate-700">
                                  {exam.instancia}
                                </td>
                                <td className="py-2 pr-2 text-slate-700">
                                  {formatDate(exam.fecha_examen)}
                                </td>
                                <td className="py-2 pr-2 text-slate-700">
                                  {exam.rendido === 1
                                    ? formatNota(exam.nota)
                                    : "—"}
                                </td>
                                <td className="py-2 font-medium">
                                  {exam.ausente === 1 && (
                                    <span className="text-slate-500">
                                      ○ Ausente
                                    </span>
                                  )}
                                  {exam.rendido === 1 &&
                                    Number(exam.nota) >= 4 && (
                                      <span className="text-green-700">
                                        ✅ Aprobado
                                      </span>
                                    )}
                                  {exam.rendido === 1 &&
                                    Number(exam.nota) < 4 && (
                                      <span className="text-red-700">
                                        ❌ Desaprobado
                                      </span>
                                    )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === "predicciones" && (
          <section className="space-y-4">
            <p className="text-sm text-slate-600">
              Predicciones automáticas para este alumno:
            </p>

            {alumno.prediccion &&
              (Object.keys(alumno.prediccion).length > 0 ? (
                <div className="space-y-4">
                  {/* 1. PREDICCIÓN DE ABANDONO */}
                  {alumno.prediccion.abandono && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <h5 className="text-sm font-semibold text-red-900 mb-3">
                        🔴 Riesgo de Abandono de Carrera
                      </h5>
                      <RiskBadge risk={alumno.prediccion.abandono.risk} />
                      {alumno.prediccion.abandono.probabilidad !== null &&
                      alumno.prediccion.abandono.probabilidad !== undefined ? (
                        <div className="mt-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-red-700">Probabilidad:</span>
                            <span className="font-semibold text-red-900">
                              {formatPercent(
                                alumno.prediccion.abandono.probabilidad,
                              )}
                            </span>
                          </div>
                          <div className="w-full bg-red-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                alumno.prediccion.abandono.probabilidad > 0.7
                                  ? "bg-red-600"
                                  : alumno.prediccion.abandono.probabilidad >
                                      0.5
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              }`}
                              style={{
                                width: `${Math.min(
                                  alumno.prediccion.abandono.probabilidad * 100,
                                  100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-red-600 mt-2">
                          {alumno.prediccion.abandono.error ||
                            "No se pudo calcular"}
                        </p>
                      )}
                      {alumno.prediccion.abandono.probabilidad > 0.5 && (
                        <div className="mt-3 rounded-md border border-orange-300 bg-orange-50 p-2">
                          <p className="text-xs text-orange-900 font-medium">
                            💡 Intervención recomendada
                          </p>
                          <ul className="text-xs text-orange-800 mt-1 space-y-0.5 ml-4 list-disc">
                            <li>Contactá con tutorías</li>
                            <li>Seguimiento personalizado</li>
                            <li>Ayuda financiera si aplica</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. PREDICCIÓN DE RECURSADO */}
                  {alumno.prediccion.recursado && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                      <h5 className="text-sm font-semibold text-orange-900 mb-3">
                        🔄 Riesgo de Recursado en Materia
                      </h5>
                      <RiskBadge risk={alumno.prediccion.recursado.risk} />
                      {alumno.prediccion.recursado.probabilidad !== null &&
                      alumno.prediccion.recursado.probabilidad !== undefined ? (
                        <div className="mt-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-orange-700">
                              Probabilidad:
                            </span>
                            <span className="font-semibold text-orange-900">
                              {formatPercent(
                                alumno.prediccion.recursado.probabilidad,
                              )}
                            </span>
                          </div>
                          <div className="w-full bg-orange-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                alumno.prediccion.recursado.probabilidad > 0.7
                                  ? "bg-red-500"
                                  : alumno.prediccion.recursado.probabilidad >
                                      0.5
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              }`}
                              style={{
                                width: `${Math.min(
                                  alumno.prediccion.recursado.probabilidad *
                                    100,
                                  100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-orange-600 mt-2">
                          {alumno.prediccion.recursado.error ||
                            "No se pudo calcular"}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 3. PREDICCIÓN DE NOTA EXAMEN */}
                  {alumno.prediccion.nota && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <h5 className="text-sm font-semibold text-blue-900 mb-3">
                        📝 Predicción de Próxima Nota
                      </h5>
                      {alumno.prediccion.nota.examen_info ? (
                        <div className="space-y-2">
                          <div className="text-xs text-blue-700 mb-2">
                            <span className="font-medium">
                              {alumno.prediccion.nota.examen_info.tipo}
                            </span>
                            {" · Instancia "}
                            <span className="font-medium">
                              {alumno.prediccion.nota.examen_info.instancia}
                            </span>
                          </div>
                          {alumno.prediccion.nota.nota !== null &&
                          alumno.prediccion.nota.nota !== undefined ? (
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-blue-700">
                                  Predicción:
                                </span>
                                <span className="font-semibold text-blue-900">
                                  {formatNota(alumno.prediccion.nota.nota)}/10
                                </span>
                              </div>
                              <div className="w-full bg-blue-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    alumno.prediccion.nota.nota >= 8
                                      ? "bg-green-500"
                                      : alumno.prediccion.nota.nota >= 6
                                        ? "bg-amber-500"
                                        : alumno.prediccion.nota.nota >= 4
                                          ? "bg-orange-500"
                                          : "bg-red-500"
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      (alumno.prediccion.nota.nota / 10) * 100,
                                      100,
                                    )}%`,
                                  }}
                                />
                              </div>
                              <RiskBadge
                                risk={alumno.prediccion.nota.nota_level}
                              />
                            </div>
                          ) : (
                            <p className="text-xs text-blue-600 mt-2">
                              {alumno.prediccion.nota.error ||
                                "No se pudo calcular"}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          {alumno.prediccion.nota.error ||
                            "No hay próximos exámenes para predecir"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
                  Sin predicciones disponibles
                </p>
              ))}
          </section>
        )}
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

export default function PanelPredicciones() {
  const [materias, setMaterias] = useState([]);
  const [materiaActiva, setMateriaActiva] = useState(null);
  const [datos, setDatos] = useState(null);
  const [predicciones, setPredicciones] = useState({});
  const [alumnoDetalle, setAlumnoDetalle] = useState(null);
  const [alumnoData, setAlumnoData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingPredicciones, setLoadingPredicciones] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [error, setError] = useState("");
  // Ref para cancelar cargas de predicciones si el usuario cambia de materia
  const activeMateriaRef = useRef(null);

  useEffect(() => {
    let active = true;

    const loadMaterias = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/api/panel-predicciones/materias");
        if (!active) return;

        const materiasData = response.data || [];
        setMaterias(materiasData);

        if (materiasData.length > 0) {
          await cargarAlumnos(materiasData[0].id, materiasData);
        }
      } catch (fetchError) {
        if (active) {
          setError(
            fetchError.message || "No se pudo cargar el panel de predicciones.",
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
    activeMateriaRef.current = materiaId;
    setLoading(true);
    setError("");
    setPredicciones({});

    try {
      // Fase 1: cargar alumnos sin predicciones (rápido)
      const response = await api.get(
        `/api/panel-predicciones/materias/${materiaId}/panel-predicciones?skipPredicciones=true`,
      );

      if (activeMateriaRef.current !== materiaId) return;

      setDatos(response.data);

      const selected = (materiasRef || []).find(
        (m) => Number(m.id) === Number(materiaId),
      );
      setMateriaActiva(selected || response.data?.materia || null);
      setLoading(false);

      // Fase 2: cargar predicciones página por página (C)
      const totalAlumnos = response.data?.cursando?.length ?? 0;
      if (totalAlumnos > 0) {
        setLoadingPredicciones(true);
        const totalPages = Math.ceil(totalAlumnos / PAGE_SIZE);
        try {
          for (let page = 1; page <= totalPages; page++) {
            if (activeMateriaRef.current !== materiaId) break;

            const predResp = await api.get(
              `/api/panel-predicciones/materias/${materiaId}/predicciones?page=${page}&pageSize=${PAGE_SIZE}`,
            );

            if (activeMateriaRef.current !== materiaId) break;

            setPredicciones((prev) => ({
              ...prev,
              ...predResp.data.predicciones,
            }));
          }
        } catch {
          // Las predicciones son opcionales; no bloquear la UI
        } finally {
          if (activeMateriaRef.current === materiaId) {
            setLoadingPredicciones(false);
          }
        }
      }
    } catch (fetchError) {
      if (activeMateriaRef.current === materiaId) {
        setError(fetchError.message || "No se pudieron cargar los alumnos.");
        setLoading(false);
      }
    }
  };

  const cargarDetalle = async (alumnoId) => {
    setLoadingDetalle(true);
    setError("");

    try {
      const response = await api.get(
        `/api/panel-predicciones/alumnos/${alumnoId}`,
      );
      setAlumnoData(response.data);

      // Obtener alumno del listado actual
      if (datos) {
        const alumno = (datos.cursando || []).find((a) => a.id === alumnoId);
        if (alumno) {
          setAlumnoDetalle({
            ...alumno,
            prediccion: predicciones[alumno.id] ?? null,
          });
        }
      }
    } catch (fetchError) {
      setError(
        fetchError.message || "No se pudo cargar el detalle del alumno.",
      );
    } finally {
      setLoadingDetalle(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Panel de Predicciones
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Visualiza el riesgo de abandono de tus alumnos y accede a predicciones
          detalladas por materia.
        </p>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Selector de materias — dropdown */}
      {materias.length > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <label
            htmlFor="materia-select"
            className="text-sm font-medium text-slate-700 whitespace-nowrap"
          >
            Materia:
          </label>
          <select
            id="materia-select"
            value={materiaActiva?.id ?? ""}
            onChange={(e) => cargarAlumnos(Number(e.target.value))}
            disabled={loading}
            className="flex-1 min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          >
            {materias.map((materia) => (
              <option key={materia.id} value={materia.id}>
                {materia.nombre}
                {materia.total_relevantes != null
                  ? ` (${materia.total_relevantes} alumnos)`
                  : ""}
              </option>
            ))}
          </select>
        </section>
      )}

      {/* Resumen */}
      {datos ? (
        <section className="grid gap-3 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 p-3 bg-white">
            <p className="text-xs text-slate-500">Total cursando</p>
            <p className="text-lg font-semibold text-slate-900">
              {datos.resumen.total}
            </p>
          </article>
          <article className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center gap-2">
            <p className="text-xs text-blue-600 flex-1">
              {loadingPredicciones
                ? "Calculando predicciones..."
                : "Predicciones listas"}
            </p>
            {loadingPredicciones && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            )}
          </article>
        </section>
      ) : null}

      {/* Lista de alumnos */}
      {loading ? (
        <LoadingSpinner size="md" text="Cargando alumnos..." />
      ) : datos ? (
        <section className="space-y-6">
          {(datos.cursando?.length ?? 0) > 0 ? (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-sm font-semibold text-blue-900">
                📚 Cursando ({datos.cursando.length})
              </h3>
              <div className="space-y-2">
                {datos.cursando.map((alumno) => (
                  <AlumnoFila
                    key={alumno.id}
                    alumno={{
                      ...alumno,
                      prediccion: predicciones[alumno.id] ?? null,
                    }}
                    onViewDetail={cargarDetalle}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 rounded-lg border border-slate-200 bg-white p-4">
              No hay alumnos cursando esta materia actualmente.
            </p>
          )}
        </section>
      ) : null}

      {/* Modal background */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-200 ${
          alumnoDetalle ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => {
          setAlumnoDetalle(null);
          setAlumnoData(null);
        }}
      />

      {/* Detalle panel */}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-full overflow-y-auto bg-white shadow-xl transition-transform duration-300 md:w-[40%] md:max-w-none ${
          alumnoDetalle ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <DetallePanel
          alumno={alumnoDetalle}
          alumnoData={alumnoData}
          onClose={() => {
            setAlumnoDetalle(null);
            setAlumnoData(null);
          }}
          loading={loadingDetalle}
          materiaActiva={materiaActiva}
        />
      </aside>
    </div>
  );
}
