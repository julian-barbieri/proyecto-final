import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import KpiCard from "../components/dashboard/KpiCard";
import SeccionRendimiento from "../components/dashboard/SeccionRendimiento";

function SkeletonLoader() {
  return (
    <div className="space-y-6">
      {/* KPI Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-gray-200 rounded-lg h-24 w-full"
          />
        ))}
      </div>

      {/* Alertas y Distribución Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="animate-pulse bg-gray-200 rounded-lg h-64 w-full" />
        <div className="animate-pulse bg-gray-200 rounded-lg h-64 w-full" />
      </div>

      {/* Tabla Skeleton */}
      <div className="animate-pulse space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-gray-200 rounded-lg h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tabActiva, setTabActiva] = useState("resumen");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados para la tab de rendimiento
  const [anioSeleccionado, setAnioSeleccionado] = useState(
    new Date().getFullYear(),
  );
  const [dataRendimiento, setDataRendimiento] = useState(null);
  const [loadingRend, setLoadingRend] = useState(false);
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [materiaSeleccionada, setMateriaSeleccionada] = useState(null);

  useEffect(() => {
    const cargarDashboard = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get("/api/dashboard");
        setData(response.data);
      } catch (err) {
        console.error("Error cargando dashboard:", err);
        setError(err.message || "Error al cargar el dashboard");
      } finally {
        setLoading(false);
      }
    };

    cargarDashboard();
  }, []);

  // Cargar datos de rendimiento cuando cambia la tab o el año
  useEffect(() => {
    if (tabActiva !== "rendimiento") return;

    const cargarRendimiento = async () => {
      try {
        setLoadingRend(true);
        const response = await api.get(
          `/api/dashboard/rendimiento?anio=${anioSeleccionado}`,
        );
        setDataRendimiento(response.data.por_materia);
        setAniosDisponibles(response.data.anios_disponibles);
      } catch (err) {
        console.error("Error cargando rendimiento:", err);
        setDataRendimiento([]);
      } finally {
        setLoadingRend(false);
      }
    };

    cargarRendimiento();
  }, [tabActiva, anioSeleccionado]);

  if (!user || !["admin", "coordinador"].includes(user.role)) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">
          No autorizado. Este dashboard es solo para admin y coordinadores.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg">
        <SkeletonLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <p className="font-medium">Error al cargar el dashboard</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6">Sin datos disponibles</div>;
  }

  // Extraer datos
  const {
    kpis,
    abandono,
    por_materia,
    distribucion_por_materia,
    alertas,
    actividad_reciente,
    ai_disponible,
  } = data;

  const formatearFecha = (isoString) => {
    const date = new Date(isoString);
    const ahora = new Date();
    const diff = Math.floor((ahora - date) / 1000);

    if (diff < 60) return "hace unos segundos";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} minutos`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} horas`;
    return `hace ${Math.floor(diff / 86400)} días`;
  };

  const getTipoIcono = (tipo) => {
    switch (tipo) {
      case "abandono":
        return "🎓";
      case "recursado":
        return "📚";
      case "nota":
        return "📝";
      default:
        return "📊";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header personalizado */}
      <div>
        <h1 className="text-2xl font-medium text-gray-900">
          Buenos días, {user.nombre_completo.split(" ")[0]}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString("es-AR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          {" · "}Sistema de Predicciones Académicas
        </p>

        {!ai_disponible && data && (
          <div className="mt-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            ⚠ El servicio de predicciones ML no está disponible. Se muestran
            solo datos académicos.
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-8">
          {[
            { key: "resumen", label: "Resumen general" },
            { key: "rendimiento", label: "Rendimiento por examen" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTabActiva(tab.key)}
              className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                tabActiva === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido de las tabs */}
      {tabActiva === "resumen" && (
        <SeccionResumen
          loading={loading}
          error={error}
          data={data}
          navigate={navigate}
          user={user}
          ai_disponible={data?.ai_disponible}
        />
      )}

      {tabActiva === "rendimiento" && (
        <SeccionRendimiento
          data={dataRendimiento}
          loading={loadingRend}
          anio={anioSeleccionado}
          aniosDisponibles={aniosDisponibles}
          onAnioChange={setAnioSeleccionado}
          materiaSeleccionada={materiaSeleccionada}
          onMateriaChange={setMateriaSeleccionada}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Componente SeccionResumen - Contiene el layout anterior del Dashboard
// ═════════════════════════════════════════════════════════════════════════════

function SeccionResumen({
  loading,
  error,
  data,
  navigate,
  user,
  ai_disponible,
}) {
  const [materiaSeleccionadaTasa, setMateriaSeleccionadaTasa] = useState(null);
  const [materiaSeleccionadaDistribucion, setMateriaSeleccionadaDistribucion] =
    useState(null);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* KPI Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-gray-200 rounded-lg h-24 w-full"
            />
          ))}
        </div>

        {/* Alertas y Distribución Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="animate-pulse bg-gray-200 rounded-lg h-64 w-full" />
          <div className="animate-pulse bg-gray-200 rounded-lg h-64 w-full" />
        </div>

        {/* Tabla Skeleton */}
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <p className="font-medium">Error al cargar el dashboard</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6">Sin datos disponibles</div>;
  }

  // Extraer datos
  const {
    kpis,
    abandono,
    por_materia,
    distribucion_por_materia,
    alertas,
    actividad_reciente,
  } = data;

  const formatearFecha = (isoString) => {
    const date = new Date(isoString);
    const ahora = new Date();
    const diff = Math.floor((ahora - date) / 1000);

    if (diff < 60) return "hace unos segundos";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} minutos`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} horas`;
    return `hace ${Math.floor(diff / 86400)} días`;
  };

  const getTipoIcono = (tipo) => {
    switch (tipo) {
      case "abandono":
        return "🎓";
      case "recursado":
        return "📚";
      case "nota":
        return "📝";
      default:
        return "📊";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          titulo="Total alumnos"
          valor={kpis.total_alumnos}
          subtitulo="registrados"
          color="blue"
          icono="👥"
        />
        <KpiCard
          titulo="Cursando"
          valor={kpis.cursando_ahora}
          subtitulo="en cursada activa"
          color="green"
          icono="📖"
        />
        <KpiCard
          titulo="Tasa de recursado"
          valor={`${kpis.tasa_recursado_global}%`}
          subtitulo="Promedio histórico"
          color="amber"
          icono="🔄"
        />
        <KpiCard
          titulo="Promedio de notas"
          valor={kpis.promedio_notas_global}
          subtitulo="en exámenes rendidos"
          color="blue"
          icono="🧾"
        />
      </div>

      {/* Alerta de asistencia baja */}
      {kpis.alumnos_asistencia_baja > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-4 py-3 rounded-lg border border-amber-200">
          <span>⚠</span>
          <span>
            <strong>{kpis.alumnos_asistencia_baja}</strong> alumno/s con
            asistencia por debajo del 75% — no podrán rendir finales si no
            mejoran.
          </span>
        </div>
      )}

      {/* Alerta de finales AM2 bloqueados */}
      {kpis.finales_am2_bloqueados > 0 && (
        <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-4 py-3 rounded-lg border border-blue-200">
          <span>ℹ</span>
          <span>
            <strong>{kpis.finales_am2_bloqueados}</strong> alumno/s cursando AM2
            tiene/n el final de AM1 pendiente — no podrá/n rendir finales de AM2
            hasta aprobarlo.
          </span>
        </div>
      )}

      {/* SECCIÓN 2: Alertas + Distribución de riesgo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas de abandono */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-red-50 to-red-50 px-6 py-4 border-b border-red-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              🚨 Alumnos en riesgo de abandono
              <span className="ml-auto inline-block bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                {abandono.en_riesgo_alto}
              </span>
            </h2>
          </div>
          <div className="p-6 space-y-1">
            {alertas.length > 0 ? (
              alertas.map((alumno) => (
                <div
                  key={alumno.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-lg ${
                        alumno.nivel_riesgo === "alto"
                          ? "text-red-500"
                          : "text-amber-500"
                      }`}
                    >
                      {alumno.nivel_riesgo === "alto" ? "🔴" : "🟡"}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {alumno.nombre}
                      </p>
                      <p className="text-xs text-gray-500">Prob. abandono</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          alumno.nivel_riesgo === "alto"
                            ? "bg-red-500"
                            : "bg-amber-400"
                        }`}
                        style={{
                          width: `${(alumno.probabilidad * 100).toFixed(0)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-10 text-right text-gray-900">
                      {(alumno.probabilidad * 100).toFixed(0)}%
                    </span>
                    <button
                      onClick={() => navigate(`/alumnos/${alumno.id}`)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Ver →
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 py-3">
                Sin alumnos en riesgo alto
              </p>
            )}
          </div>
        </div>

        {/* Distribución de riesgo */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-blue-50 px-6 py-4 border-b border-blue-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Distribución de riesgo 🔵🟡🔴
            </h2>
          </div>
          <div className="p-6 space-y-6">
            {[
              {
                label: "Alto",
                count: abandono.en_riesgo_alto,
                color: "bg-red-500",
                textColor: "text-red-700",
              },
              {
                label: "Medio",
                count: abandono.en_riesgo_medio,
                color: "bg-amber-400",
                textColor: "text-amber-700",
              },
              {
                label: "Bajo",
                count: abandono.sin_riesgo,
                color: "bg-green-500",
                textColor: "text-green-700",
              },
            ].map((barra) => {
              const total =
                abandono.en_riesgo_alto +
                abandono.en_riesgo_medio +
                abandono.sin_riesgo;
              const pct =
                total > 0 ? ((barra.count / total) * 100).toFixed(0) : 0;
              return (
                <div key={barra.label}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {barra.label}
                    </span>
                    <span
                      className={`text-sm font-semibold ${barra.textColor}`}
                    >
                      {barra.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className={`${barra.color} h-3 rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <p className="text-sm text-gray-600 mt-6 pt-4 border-t border-gray-200">
              <strong className="text-red-600">
                {abandono.tasa_riesgo_alto_pct}%
              </strong>{" "}
              de los alumnos tiene riesgo alto de abandonar. Se recomienda
              intervención inmediata en{" "}
              <strong>{abandono.en_riesgo_alto}</strong> caso/s.
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: Métricas por materia + Distribución cursadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasa de recursado por materia */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Tasa de Recursado por Materia
            </h2>
            {por_materia && por_materia.length > 0 && (
              <select
                value={materiaSeleccionadaTasa || ""}
                onChange={(e) =>
                  setMateriaSeleccionadaTasa(
                    e.target.value ? parseInt(e.target.value) : null,
                  )
                }
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas las materias</option>
                {por_materia.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigo} - {m.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-6">
            {por_materia && por_materia.length > 0 ? (
              (materiaSeleccionadaTasa
                ? por_materia.filter((m) => m.id === materiaSeleccionadaTasa)
                : por_materia
              ).map((materia) => (
                <div key={materia.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {materia.codigo} {materia.nombre}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {materia.tasa_pct ?? "—"}%
                    </span>
                  </div>
                  {materia.total_cursadas > 0 ? (
                    <>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-amber-400 h-2 rounded-full"
                          style={{
                            width: `${materia.tasa_pct || 0}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {materia.recursadas} de {materia.total_cursadas}{" "}
                        cursadas terminaron en recursado
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      Sin datos suficientes
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">Sin datos de materias</p>
            )}
          </div>
        </div>

        {/* Distribución de cursadas por materia */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Distribución de Cursadas por Materia
            </h2>
            {distribucion_por_materia &&
              distribucion_por_materia.length > 0 && (
                <select
                  value={materiaSeleccionadaDistribucion || ""}
                  onChange={(e) =>
                    setMateriaSeleccionadaDistribucion(e.target.value || null)
                  }
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas las materias</option>
                  {distribucion_por_materia.map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.codigo} - {m.nombre}
                    </option>
                  ))}
                </select>
              )}
          </div>
          <div className="space-y-8">
            {distribucion_por_materia && distribucion_por_materia.length > 0 ? (
              (materiaSeleccionadaDistribucion
                ? distribucion_por_materia.filter(
                    (m) => m.codigo === materiaSeleccionadaDistribucion,
                  )
                : distribucion_por_materia
              ).map((materia) => {
                const total =
                  materia.primera_vez +
                  materia.segunda_vez +
                  materia.tercera_vez_o_mas;
                return (
                  <div key={materia.codigo}>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      {materia.codigo} — {materia.nombre}
                    </h3>
                    <div className="space-y-3">
                      {[
                        {
                          label: "1ra vez",
                          count: materia.primera_vez,
                          icon: "📚",
                        },
                        {
                          label: "2da vez",
                          count: materia.segunda_vez,
                          icon: "🔁",
                        },
                        {
                          label: "3ra vez o más",
                          count: materia.tercera_vez_o_mas,
                          icon: "⏳",
                        },
                      ].map((item) => {
                        const pct =
                          total > 0
                            ? ((item.count / total) * 100).toFixed(0)
                            : 0;
                        return (
                          <div key={item.label}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-600">
                                {item.icon} {item.label}
                              </span>
                              <span className="text-xs font-semibold text-gray-700">
                                {item.count} ({pct}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500">Sin datos de distribución</p>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN 4: Tabla de alumnos */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            📋 Estado de todos los alumnos
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Veces
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Asistencia
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Riesgo
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {abandono.distribucion.map((alumno) => (
                <tr key={alumno.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {alumno.nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {alumno.veces_cursada}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        alumno.asistencia_pct >= 75
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {alumno.asistencia_pct}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                        alumno.nivel_riesgo === "alto"
                          ? "bg-red-50 text-red-700"
                          : alumno.nivel_riesgo === "medio"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-green-50 text-green-700"
                      }`}
                    >
                      {alumno.nivel_riesgo === "alto"
                        ? "🔴 Alto"
                        : alumno.nivel_riesgo === "medio"
                          ? "🟡 Medio"
                          : "🟢 Bajo"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => navigate(`/alumnos/${alumno.id}`)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      Ver perfil →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECCIÓN 5: Actividad reciente */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-purple-50 px-6 py-4 border-b border-purple-200">
          <h2 className="text-lg font-semibold text-gray-900">
            🕐 Actividad reciente del AI
          </h2>
        </div>
        <div className="p-6 space-y-4">
          {actividad_reciente && actividad_reciente.length > 0 ? (
            actividad_reciente.map((evento, i) => (
              <div
                key={i}
                className="flex items-start gap-4 pb-4 border-b last:border-0"
              >
                <span className="text-2xl">{getTipoIcono(evento.tipo)}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {evento.descripcion}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {evento.alumno_nombre} • {formatearFecha(evento.timestamp)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 py-3">
              Sin actividad registrada
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
