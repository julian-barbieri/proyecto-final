import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import KpiCard from "../components/dashboard/KpiCard";
import SeccionRendimiento from "../components/dashboard/SeccionRendimiento";
import {
  Users, BookOpen, RotateCcw, ClipboardList, AlertTriangle,
  TrendingUp, Target, Clock, CheckCircle2, Zap,
  BarChart3, Activity, PieChart, GraduationCap,
} from "lucide-react";

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
      <div>
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
  const [modalAsistencia, setModalAsistencia] = useState(false);
  const [modalEstancados, setModalEstancados] = useState(false);

  const [anioCursada, setAnioCursada] = useState(new Date().getFullYear());
  const [aniosCursadaDisponibles, setAniosCursadaDisponibles] = useState([new Date().getFullYear()]);
  const [dataPorMateria, setDataPorMateria] = useState(null);
  const [dataDistribucion, setDataDistribucion] = useState(null);
  const [loadingAnio, setLoadingAnio] = useState(false);

  useEffect(() => {
    const fetchPorMateria = async () => {
      try {
        setLoadingAnio(true);
        const resp = await api.get(`/api/dashboard/por-materia?anio_cursada=${anioCursada}`);
        setDataPorMateria(resp.data.por_materia);
        setDataDistribucion(resp.data.distribucion);
        setAniosCursadaDisponibles(resp.data.anios_disponibles);
      } catch (err) {
        console.error("Error cargando datos por materia:", err);
        setDataPorMateria([]);
        setDataDistribucion([]);
      } finally {
        setLoadingAnio(false);
      }
    };
    fetchPorMateria();
  }, [anioCursada]);

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
    alumnos_bajo_riesgo,
    alumnos_asistencia_baja_lista,
    estrategico,
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
      accion: {
        label: "Ver alumnos",
        onClick: () => setModalAsistencia(true),
      },
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
    <div className="space-y-8">
      {/* Modales */}
      {modalRiesgo && (
        <ModalAlumnosRiesgo
          titulo={modalRiesgo.titulo}
          alumnos={modalRiesgo.alumnos}
          onClose={() => setModalRiesgo(null)}
          navigate={navigate}
        />
      )}
      {modalAsistencia && (
        <ModalAsistenciaBaja
          alumnos={alumnos_asistencia_baja_lista || []}
          onClose={() => setModalAsistencia(false)}
          navigate={navigate}
        />
      )}
      {modalEstancados && (
        <ModalEstancados
          alumnos={estrategico?.alumnos_estancados_lista || []}
          onClose={() => setModalEstancados(false)}
          navigate={navigate}
        />
      )}

      {/* Panel de acciones requeridas */}
      {acciones.length > 0 && (
        <PanelAccionesRequeridas acciones={acciones} />
      )}

      {/* ── VISIÓN GENERAL ── */}
      <div>
        <SectionLabel>Visión general</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            titulo="Total alumnos"
            valor={kpis.total_alumnos}
            subtitulo="registrados en el sistema"
            color="blue"
            icono={<Users className="w-5 h-5" />}
          />
          <KpiCard
            titulo="Cursando ahora"
            valor={kpis.cursando_ahora}
            subtitulo="en cursada activa este año"
            color="green"
            icono={<BookOpen className="w-5 h-5" />}
          />
          <KpiCard
            titulo="Tasa de recursado"
            valor={`${kpis.tasa_recursado_global}%`}
            subtitulo="promedio histórico"
            color="amber"
            icono={<RotateCcw className="w-5 h-5" />}
            tendencia={
              kpis.tendencias?.tasa_aprobacion_parciales
                ? { ...kpis.tendencias.tasa_aprobacion_parciales, sufijo: "% aprob. parciales", arriba_es_bueno: true }
                : null
            }
          />
          <KpiCard
            titulo="Promedio de notas"
            valor={kpis.promedio_notas_global}
            subtitulo="en exámenes rendidos"
            color="blue"
            icono={<ClipboardList className="w-5 h-5" />}
            tendencia={
              kpis.tendencias?.promedio_notas
                ? { ...kpis.tendencias.promedio_notas, sufijo: " pts", arriba_es_bueno: true }
                : null
            }
          />
          <KpiCard
            titulo="Alumnos estancados"
            valor={estrategico?.alumnos_estancados ?? "—"}
            subtitulo="sin aprobar nada en +1 año"
            color="red"
            icono={<Clock className="w-5 h-5" />}
            onClick={estrategico?.alumnos_estancados > 0 ? () => setModalEstancados(true) : null}
          />
        </div>
      </div>

      {/* ── RIESGO ACADÉMICO ── */}
      <div>
        <SectionLabel>Riesgo académico</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alertas de abandono */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <h2 className="text-sm font-semibold text-gray-900">Alumnos en riesgo de abandono</h2>
              <span className="ml-auto inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-red-500 text-white text-xs font-bold">
                {abandono.en_riesgo_alto}
              </span>
            </div>
            <div className="p-6 space-y-1">
              {alertas.length > 0 ? (
                alertas.map((alumno) => {
                  const esAlto = alumno.nivel_riesgo === "alto";
                  const pct = (alumno.probabilidad * 100).toFixed(0);
                  return (
                    <div key={alumno.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${esAlto ? "bg-red-500" : "bg-amber-400"}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{alumno.nombre}</p>
                          <p className="text-xs text-gray-400">Prob. abandono</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-20 bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${esAlto ? "bg-red-500" : "bg-amber-400"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold w-8 text-right ${esAlto ? "text-red-600" : "text-amber-600"}`}>
                          {pct}%
                        </span>
                        <button
                          onClick={() => navigate(`/alumnos/${alumno.id}`)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Ver →
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-400 py-4 text-center">Sin alumnos en riesgo alto</p>
              )}
            </div>
          </div>

          {/* Distribución de riesgo */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <PieChart className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <h2 className="text-sm font-semibold text-gray-900">Distribución de riesgo</h2>
            </div>
            <div className="p-6 space-y-3">
              {[
                {
                  label: "Riesgo alto",
                  count: abandono.en_riesgo_alto,
                  bar: "bg-red-500",
                  text: "text-red-700",
                  hover: "hover:bg-red-50",
                  alumnos: alumnosAlto,
                  titulo: "Alumnos con riesgo alto de abandono",
                },
                {
                  label: "Riesgo medio",
                  count: abandono.en_riesgo_medio,
                  bar: "bg-amber-400",
                  text: "text-amber-700",
                  hover: "hover:bg-amber-50",
                  alumnos: alumnosMedio,
                  titulo: "Alumnos con riesgo medio de abandono",
                },
                {
                  label: "Sin riesgo",
                  count: abandono.sin_riesgo,
                  bar: "bg-green-500",
                  text: "text-green-700",
                  hover: "hover:bg-green-50",
                  alumnos: alumnos_bajo_riesgo || [],
                  titulo: "Alumnos sin riesgo de abandono",
                },
              ].map((barra) => {
                const total = abandono.en_riesgo_alto + abandono.en_riesgo_medio + abandono.sin_riesgo;
                const pct = total > 0 ? ((barra.count / total) * 100).toFixed(0) : 0;
                return (
                  <button
                    key={barra.label}
                    onClick={() => setModalRiesgo({ titulo: barra.titulo, alumnos: barra.alumnos })}
                    className={`w-full text-left rounded-lg px-3 py-3 transition-colors ${barra.hover} group`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{barra.label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${barra.text}`}>
                          {barra.count} <span className="font-normal text-gray-400">({pct}%)</span>
                        </span>
                        <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Ver →</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`${barra.bar} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
              <p className="text-xs text-gray-500 pt-2 border-t border-gray-100 px-3">
                <span className="font-semibold text-red-600">{abandono.tasa_riesgo_alto_pct}%</span> del total en riesgo alto — intervención recomendada en <strong>{abandono.en_riesgo_alto}</strong> caso/s.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── MÉTRICAS ESTRATÉGICAS ── */}
      {estrategico && (
        <div>
          <SectionLabel>Métricas estratégicas</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              titulo="Avance promedio del plan"
              valor={`${estrategico.avance_plan_pct}%`}
              subtitulo="materias aprobadas sobre el total"
              color="blue"
              icono={<Target className="w-5 h-5" />}
            />
            <KpiCard
              titulo="Aprob. en 1ra instancia"
              valor={`${estrategico.tasa_primera_instancia}%`}
              subtitulo="parciales aprobados al 1er intento"
              color="green"
              icono={<CheckCircle2 className="w-5 h-5" />}
            />
            <KpiCard
              titulo="Predicciones este mes"
              valor={estrategico.predicciones_este_mes}
              subtitulo="consultas al sistema ML"
              color="purple"
              icono={<Zap className="w-5 h-5" />}
            />
          </div>
        </div>
      )}

      {/* ── POR MATERIA ── */}
      <div>
        <SectionLabel>Por materia</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasa de recursado por materia */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-gray-900">Tasa de recursado por materia</h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Materia:</span>
                  <FiltroAnioMateria valor={materiaAnioTasa} onChange={setMateriaAnioTasa} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Año de cursada:</span>
                  <FiltroAnioCursada
                    valor={anioCursada}
                    onChange={setAnioCursada}
                    aniosDisponibles={aniosCursadaDisponibles}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-5">
              {loadingAnio ? (
                <div className="py-6 flex justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                </div>
              ) : dataPorMateria && dataPorMateria.length > 0 ? (
                filtrarPorAnio(dataPorMateria, materiaAnioTasa).map((materia) => (
                  <div key={materia.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-gray-700 truncate pr-2">{materia.codigo} — {materia.nombre}</span>
                      <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{materia.tasa_pct ?? "—"}%</span>
                    </div>
                    {materia.total_cursadas > 0 ? (
                      <>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${materia.tasa_pct || 0}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{materia.recursadas} de {materia.total_cursadas} cursadas</p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Sin datos suficientes</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">Sin datos de materias para {anioCursada}</p>
              )}
            </div>
          </div>

          {/* Distribución de cursadas por materia */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-gray-900">Alumnos por intento de cursada</h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Materia:</span>
                  <FiltroAnioMateria valor={materiaAnioDistribucion} onChange={setMateriaAnioDistribucion} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Año de cursada:</span>
                  <FiltroAnioCursada
                    valor={anioCursada}
                    onChange={setAnioCursada}
                    aniosDisponibles={aniosCursadaDisponibles}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-7">
              {loadingAnio ? (
                <div className="py-6 flex justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                </div>
              ) : dataDistribucion && dataDistribucion.length > 0 ? (
                filtrarPorAnio(dataDistribucion, materiaAnioDistribucion).map((materia) => {
                  const total = materia.primera_vez + materia.segunda_vez + materia.tercera_vez_o_mas;
                  return (
                    <div key={materia.codigo}>
                      <h3 className="text-sm font-medium text-gray-800 mb-2">{materia.codigo} — {materia.nombre}</h3>
                      <div className="space-y-2">
                        {[
                          { label: "1ra vez", count: materia.primera_vez, color: "bg-blue-500" },
                          { label: "2da vez", count: materia.segunda_vez, color: "bg-amber-400" },
                          { label: "3ra vez o más", count: materia.tercera_vez_o_mas, color: "bg-red-400" },
                        ].map((item) => {
                          const pct = total > 0 ? ((item.count / total) * 100).toFixed(0) : 0;
                          return (
                            <div key={item.label}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-500">{item.label}</span>
                                <span className="text-xs font-medium text-gray-700">{item.count} ({pct}%)</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div className={`${item.color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-400">Sin datos de distribución para {anioCursada}</p>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Componente SectionLabel
// ═════════════════════════════════════════════════════════════════════════════
function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Componente PanelAccionesRequeridas — banner prominente
// ═════════════════════════════════════════════════════════════════════════════
const ESTILOS_NIVEL = {
  critico: {
    card: "bg-red-50 border-red-200",
    badge: "bg-red-500 text-white",
    icon: "text-red-500",
    texto: "text-red-900",
    subtexto: "text-red-700",
    boton: "bg-red-500 hover:bg-red-600 text-white",
  },
  advertencia: {
    card: "bg-amber-50 border-amber-200",
    badge: "bg-amber-400 text-white",
    icon: "text-amber-500",
    texto: "text-amber-900",
    subtexto: "text-amber-700",
    boton: "bg-amber-400 hover:bg-amber-500 text-white",
  },
  info: {
    card: "bg-blue-50 border-blue-200",
    badge: "bg-blue-500 text-white",
    icon: "text-blue-500",
    texto: "text-blue-900",
    subtexto: "text-blue-700",
    boton: "bg-blue-500 hover:bg-blue-600 text-white",
  },
};

function PanelAccionesRequeridas({ acciones }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-200">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <span className="text-sm font-semibold text-gray-800">Acciones requeridas</span>
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
          {acciones.length}
        </span>
      </div>
      {/* Cards horizontales */}
      <div className="p-4 flex flex-col sm:flex-row gap-3">
        {acciones.map((accion, i) => {
          const e = ESTILOS_NIVEL[accion.nivel] || ESTILOS_NIVEL.info;
          return (
            <div
              key={i}
              className={`flex-1 flex flex-col gap-3 rounded-lg border p-4 ${e.card}`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex-shrink-0 ${e.icon}`}>
                  {accion.nivel === "critico"
                    ? <AlertTriangle className="w-5 h-5" />
                    : <Clock className="w-5 h-5" />}
                </span>
                <p className={`text-sm leading-snug ${e.texto}`}>{accion.texto}</p>
              </div>
              {accion.accion && (
                <button
                  onClick={accion.accion.onClick}
                  className={`self-start text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${e.boton}`}
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
// Componente FiltroAnioCursada — año calendario en que se cursó la materia
// ═════════════════════════════════════════════════════════════════════════════
function FiltroAnioCursada({ valor, onChange, aniosDisponibles }) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(Number(e.target.value))}
      className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {aniosDisponibles.map((anio) => (
        <option key={anio} value={anio}>
          {anio}
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
              const nivel = alumno.nivel_riesgo;
              const colores = nivel === "alto"
                ? { barra: "bg-red-500", texto: "text-red-600" }
                : nivel === "medio"
                  ? { barra: "bg-amber-400", texto: "text-amber-600" }
                  : { barra: "bg-green-500", texto: "text-green-600" };
              return (
                <div
                  key={alumno.id}
                  className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colores.barra}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {alumno.nombre}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${colores.barra}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold w-8 text-right ${colores.texto}`}>
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

// ═════════════════════════════════════════════════════════════════════════════
// Componente ModalAsistenciaBaja
// ═════════════════════════════════════════════════════════════════════════════
function ModalAsistenciaBaja({ alumnos, onClose, navigate }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            Alumnos con asistencia bajo el 75%
          </h2>
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
              Sin alumnos con baja asistencia.
            </p>
          ) : (
            alumnos.map((alumno) => (
              <div
                key={alumno.id}
                className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg flex-shrink-0">⚠</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {alumno.nombre_completo}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-amber-400"
                        style={{ width: `${alumno.asistencia_minima}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold w-10 text-right text-amber-600">
                      {alumno.asistencia_minima}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {alumno.materias_afectadas} materia
                    {alumno.materias_afectadas !== 1 ? "s" : ""} afectada
                    {alumno.materias_afectadas !== 1 ? "s" : ""}
                  </p>
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
            ))
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

// ═════════════════════════════════════════════════════════════════════════════
// Componente ModalEstancados
// ═════════════════════════════════════════════════════════════════════════════
function ModalEstancados({ alumnos, onClose, navigate }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            Alumnos sin aprobar en +1 año
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {alumnos.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 text-center">
              Sin alumnos estancados.
            </p>
          ) : (
            alumnos.map((alumno) => (
              <div
                key={alumno.id}
                className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors"
              >
                <Clock className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {alumno.nombre_completo}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {alumno.ultimo_anio_aprobacion
                      ? `Última aprobación: ${alumno.ultimo_anio_aprobacion}`
                      : "Sin aprobaciones registradas"}{" "}
                    · {alumno.materias_cursadas} materia{alumno.materias_cursadas !== 1 ? "s" : ""} cursada{alumno.materias_cursadas !== 1 ? "s" : ""}
                  </p>
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
            ))
          )}
        </div>

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
