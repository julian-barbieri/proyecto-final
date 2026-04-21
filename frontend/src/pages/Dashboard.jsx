import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import KpiCard from "../components/dashboard/KpiCard";
import SeccionRendimiento from "../components/dashboard/SeccionRendimiento";

function SkeletonLoader() {
  return (
    <div className="space-y-6">
      {/* Loading message */}
      <div className="flex flex-col items-center justify-center py-10 gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
          <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">
            🎓
          </div>
        </div>
        <div className="text-center">
          <p className="text-base font-medium text-gray-700">Cargando predicciones...</p>
          <p className="text-sm text-gray-400 mt-1">Esto puede tomar unos segundos</p>
        </div>
      </div>

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
          Buenos días,{" "}
          {user.nombre_completo
            ? user.nombre_completo.split(" ")[0]
            : "Usuario"}
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
  const [materiaAnioTasa, setMateriaAnioTasa] = useState("1");
  const [materiaAnioDistribucion, setMateriaAnioDistribucion] = useState("1");
  const [modalRiesgo, setModalRiesgo] = useState(null); // null | { titulo, alumnos }

  if (loading) {
    return <SkeletonLoader />;
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
    todos_en_riesgo,
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

  const alumnosAlto = (todos_en_riesgo || []).filter(
    (a) => a.nivel_riesgo === "alto",
  );
  const alumnosMedio = (todos_en_riesgo || []).filter(
    (a) => a.nivel_riesgo === "medio",
  );

  const acciones = [
    abandono.en_riesgo_alto > 0 && {
      nivel: "critico",
      icono: "🔴",
      texto: (
        <>
          <strong>{abandono.en_riesgo_alto}</strong> alumno/s con riesgo alto de
          abandono requieren intervención inmediata.
        </>
      ),
      accion: {
        label: "Ver alumnos",
        onClick: () =>
          setModalRiesgo({
            titulo: "Alumnos con riesgo alto de abandono",
            alumnos: alumnosAlto,
          }),
      },
    },
    kpis.alumnos_asistencia_baja > 0 && {
      nivel: "advertencia",
      icono: "⚠",
      texto: (
        <>
          <strong>{kpis.alumnos_asistencia_baja}</strong> alumno/s con
          asistencia bajo el 75% — no podrán rendir finales si no mejoran.
        </>
      ),
      accion: null,
    },
    abandono.en_riesgo_medio > 0 && {
      nivel: "advertencia",
      icono: "🟡",
      texto: (
        <>
          <strong>{abandono.en_riesgo_medio}</strong> alumno/s en riesgo medio
          de abandono — considerar seguimiento preventivo.
        </>
      ),
      accion: {
        label: "Ver alumnos",
        onClick: () =>
          setModalRiesgo({
            titulo: "Alumnos con riesgo medio de abandono",
            alumnos: alumnosMedio,
          }),
      },
    },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Modal alumnos en riesgo */}
      {modalRiesgo && (
        <ModalAlumnosRiesgo
          titulo={modalRiesgo.titulo}
          alumnos={modalRiesgo.alumnos}
          onClose={() => setModalRiesgo(null)}
          navigate={navigate}
        />
      )}

      {/* Panel de acciones requeridas */}
      {acciones.length > 0 && (
        <PanelAccionesRequeridas acciones={acciones} />
      )}

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
          tendencia={
            kpis.tendencias?.tasa_aprobacion_parciales
              ? {
                  ...kpis.tendencias.tasa_aprobacion_parciales,
                  sufijo: "% aprob. parciales",
                  arriba_es_bueno: true,
                }
              : null
          }
        />
        <KpiCard
          titulo="Promedio de notas"
          valor={kpis.promedio_notas_global}
          subtitulo="en exámenes rendidos"
          color="blue"
          icono="🧾"
          tendencia={
            kpis.tendencias?.promedio_notas
              ? {
                  ...kpis.tendencias.promedio_notas,
                  sufijo: " pts",
                  arriba_es_bueno: true,
                }
              : null
          }
        />
      </div>

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
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">
              Tasa de Recursado por Materia
            </h2>
            <FiltroAnioMateria
              valor={materiaAnioTasa}
              onChange={setMateriaAnioTasa}
            />
          </div>
          <div className="space-y-6">
            {por_materia && por_materia.length > 0 ? (
              filtrarPorAnio(por_materia, materiaAnioTasa).map((materia) => (
                <div key={materia.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {materia.codigo} — {materia.nombre}
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
                          style={{ width: `${materia.tasa_pct || 0}%` }}
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
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">
              Alumnos por intento de cursada
            </h2>
            <FiltroAnioMateria
              valor={materiaAnioDistribucion}
              onChange={setMateriaAnioDistribucion}
            />
          </div>
          <div className="space-y-8">
            {distribucion_por_materia && distribucion_por_materia.length > 0 ? (
              filtrarPorAnio(distribucion_por_materia, materiaAnioDistribucion).map(
                (materia) => {
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
                          { label: "1ra vez", count: materia.primera_vez, icon: "📚" },
                          { label: "2da vez", count: materia.segunda_vez, icon: "🔁" },
                          { label: "3ra vez o más", count: materia.tercera_vez_o_mas, icon: "⏳" },
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
                },
              )
            ) : (
              <p className="text-sm text-gray-500">Sin datos de distribución</p>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN 4: Actividad reciente */}
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

// ═════════════════════════════════════════════════════════════════════════════
// Componente PanelAccionesRequeridas
// ═════════════════════════════════════════════════════════════════════════════

const ESTILOS_NIVEL = {
  critico: {
    contenedor: "bg-red-50 border-red-300",
    icono: "text-red-500",
    texto: "text-red-800",
    boton: "bg-red-100 hover:bg-red-200 text-red-700 border-red-300",
  },
  advertencia: {
    contenedor: "bg-amber-50 border-amber-300",
    icono: "text-amber-500",
    texto: "text-amber-800",
    boton: "bg-amber-100 hover:bg-amber-200 text-amber-700 border-amber-300",
  },
  info: {
    contenedor: "bg-blue-50 border-blue-300",
    icono: "text-blue-500",
    texto: "text-blue-800",
    boton: "bg-blue-100 hover:bg-blue-200 text-blue-700 border-blue-300",
  },
};

function PanelAccionesRequeridas({ acciones }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
        <span className="text-base font-semibold text-gray-900">
          Acciones requeridas
        </span>
        <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
          {acciones.length}
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        {acciones.map((accion, i) => {
          const estilos = ESTILOS_NIVEL[accion.nivel] || ESTILOS_NIVEL.info;
          return (
            <div
              key={i}
              className={`flex items-center justify-between px-5 py-3 border-l-4 ${estilos.contenedor}`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-lg flex-shrink-0 ${estilos.icono}`}>
                  {accion.icono}
                </span>
                <p className={`text-sm ${estilos.texto}`}>{accion.texto}</p>
              </div>
              {accion.accion && (
                <button
                  onClick={accion.accion.onClick}
                  className={`ml-4 flex-shrink-0 text-xs font-medium px-3 py-1 rounded border transition-colors ${estilos.boton}`}
                >
                  {accion.accion.label} →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Helper: filtrar materias por año de carrera
// "all" muestra todas; "1".."5" filtra por anio_carrera
// ═════════════════════════════════════════════════════════════════════════════
function filtrarPorAnio(lista, anio) {
  if (!anio || anio === "all") return lista;
  return lista.filter((m) => String(m.anio_carrera) === String(anio));
}

// ═════════════════════════════════════════════════════════════════════════════
// Componente FiltroAnioMateria
// ═════════════════════════════════════════════════════════════════════════════
const ANIOS_CARRERA = [
  { value: "1", label: "1er año" },
  { value: "2", label: "2do año" },
  { value: "3", label: "3er año" },
  { value: "4", label: "4to año" },
  { value: "5", label: "5to año" },
  { value: "all", label: "Todas" },
];

function FiltroAnioMateria({ valor, onChange }) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {ANIOS_CARRERA.map((a) => (
        <option key={a.value} value={a.value}>
          {a.label}
        </option>
      ))}
    </select>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Componente ModalAlumnosRiesgo
// ═════════════════════════════════════════════════════════════════════════════
function ModalAlumnosRiesgo({ titulo, alumnos, onClose, navigate }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {alumnos.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">
              Sin alumnos en este nivel de riesgo.
            </p>
          ) : (
            alumnos.map((alumno) => {
              const pct = ((alumno.probabilidad || 0) * 100).toFixed(0);
              const esAlto = alumno.nivel_riesgo === "alto";
              return (
                <div
                  key={alumno.id}
                  className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-lg flex-shrink-0">
                    {esAlto ? "🔴" : "🟡"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {alumno.nombre}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${esAlto ? "bg-red-500" : "bg-amber-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-semibold w-8 text-right ${esAlto ? "text-red-600" : "text-amber-600"}`}
                      >
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      navigate(`/alumnos/${alumno.id}`);
                    }}
                    className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Ver perfil →
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
