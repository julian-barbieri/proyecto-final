import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${Math.round(Number(value) * 100)}%`;
}

function formatRatioPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "0%";
  return `${Math.round(Number(value) * 100)}%`;
}

function formatNota(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
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
  if (value < 0.75) return { dotClass: "bg-orange-500", label: "Asistencia baja" };
  if (value < 0.8) return { dotClass: "bg-yellow-500", label: "Asistencia media" };
  return { dotClass: "bg-green-500", label: "Asistencia estable" };
}

function getRiskLevel(prediccion) {
  if (!prediccion) return "sin_datos";
  const abandono = prediccion.abandono?.probabilidad;
  const recursado = prediccion.recursado?.probabilidad;
  if (abandono == null && recursado == null) return "sin_datos";
  const max = Math.max(abandono ?? 0, recursado ?? 0);
  if (max > 0.7) return "alto";
  if (max > 0.5) return "medio";
  return "bajo";
}

function getRecursadoRiskLevel(prediccion) {
  if (!prediccion) return "sin_datos";
  const prob = prediccion.recursado?.probabilidad;
  if (prob == null) return "sin_datos";
  if (prob > 0.7) return "alto";
  if (prob > 0.5) return "medio";
  return "bajo";
}

// ─── Componentes compartidos ─────────────────────────────────────────────────

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
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${colors[risk.color] || colors.green}`}>
      {risk.icon} {label || risk.label}
    </span>
  );
}

function RiskLevelBadge({ level }) {
  const config = {
    alto:      { label: "Alto riesgo",  className: "bg-red-100 text-red-700" },
    medio:     { label: "Medio riesgo", className: "bg-amber-100 text-amber-700" },
    bajo:      { label: "Bajo riesgo",  className: "bg-green-100 text-green-700" },
    sin_datos: { label: "Sin datos",    className: "bg-slate-100 text-slate-500" },
  };
  const { label, className } = config[level] ?? config.sin_datos;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ─── Celdas de tabla ─────────────────────────────────────────────────────────

function LoadingDot() {
  return <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />;
}

function ProbCel({ value, loading }) {
  if (loading) return <LoadingDot />;
  if (value == null || Number.isNaN(Number(value))) return <span className="text-slate-400 text-xs">—</span>;
  const pct = Math.round(Number(value) * 100);
  const color = pct > 70 ? "text-red-700 font-semibold" : pct > 50 ? "text-amber-700 font-medium" : "text-green-700";
  const bar   = pct > 70 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm tabular-nums ${color}`}>{pct}%</span>
      <div className="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NotaCel({ value, loading }) {
  if (loading) return <LoadingDot />;
  if (value == null || Number.isNaN(Number(value))) return <span className="text-slate-400 text-xs">—</span>;
  const nota = Number(value);
  const color = nota >= 8 ? "text-green-700" : nota >= 6 ? "text-blue-700" : nota >= 4 ? "text-amber-700" : "text-red-700";
  return <span className={`text-sm font-medium tabular-nums ${color}`}>{nota.toFixed(2)}</span>;
}

function AsistenciaCel({ value }) {
  if (value == null) return <span className="text-slate-400 text-xs">—</span>;
  const pct    = Math.round(Number(value) * 100);
  const signal = getAssistanceSignal(value);
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${signal.dotClass}`} title={signal.label} />
      <span className="text-sm tabular-nums">{pct}%</span>
    </div>
  );
}

// ─── Ícono de ordenamiento ────────────────────────────────────────────────────

function SortIcon({ column, sortBy, sortDir }) {
  if (sortBy !== column) return <span className="ml-1 text-slate-300">↕</span>;
  return <span className="ml-1 text-blue-500">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

// ─── Tabla de alumnos ─────────────────────────────────────────────────────────

function TablaAlumnos({ alumnos, predicciones, loadingPredicciones, onViewDetail, userRole, getRiskFn }) {
  const [sortBy,  setSortBy]  = useState("riesgo");
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const RISK_ORDER = { alto: 3, medio: 2, bajo: 1, sin_datos: 0 };
    return [...alumnos].sort((a, b) => {
      const predA = predicciones[a.id];
      const predB = predicciones[b.id];
      let valA, valB;

      if (sortBy === "nombre") {
        return sortDir === "asc"
          ? a.nombre_completo.localeCompare(b.nombre_completo)
          : b.nombre_completo.localeCompare(a.nombre_completo);
      }

      switch (sortBy) {
        case "asistencia": valA = Number(a.ultima_asistencia ?? -1); valB = Number(b.ultima_asistencia ?? -1); break;
        case "veces":      valA = Number(a.veces_cursada ?? 0);      valB = Number(b.veces_cursada ?? 0);      break;
        case "abandono":   valA = predA?.abandono?.probabilidad ?? -1; valB = predB?.abandono?.probabilidad ?? -1; break;
        case "recursado":  valA = predA?.recursado?.probabilidad ?? -1; valB = predB?.recursado?.probabilidad ?? -1; break;
        case "nota":       valA = predA?.nota?.nota ?? -1;            valB = predB?.nota?.nota ?? -1;            break;
        default:           valA = RISK_ORDER[getRiskFn(predA)] ?? 0; valB = RISK_ORDER[getRiskFn(predB)] ?? 0;
      }
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
  }, [alumnos, predicciones, sortBy, sortDir]);

  const thClass =
    "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-800 transition-colors whitespace-nowrap";

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className={thClass} onClick={() => handleSort("nombre")}>
              Alumno <SortIcon column="nombre" sortBy={sortBy} sortDir={sortDir} />
            </th>
            <th className={thClass} onClick={() => handleSort("asistencia")}>
              Asistencia <SortIcon column="asistencia" sortBy={sortBy} sortDir={sortDir} />
            </th>
            <th className={thClass} onClick={() => handleSort("veces")}>
              Cursada <SortIcon column="veces" sortBy={sortBy} sortDir={sortDir} />
            </th>
            {userRole !== "docente" && (
              <th className={thClass} onClick={() => handleSort("abandono")}>
                Riesgo abandono <SortIcon column="abandono" sortBy={sortBy} sortDir={sortDir} />
              </th>
            )}
            <th className={thClass} onClick={() => handleSort("recursado")}>
              Riesgo recursado <SortIcon column="recursado" sortBy={sortBy} sortDir={sortDir} />
            </th>
            <th className={thClass} onClick={() => handleSort("nota")}>
              Nota estimada <SortIcon column="nota" sortBy={sortBy} sortDir={sortDir} />
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((alumno) => {
            const pred     = predicciones[alumno.id];
            const loading  = loadingPredicciones && !pred;
            const level    = getRiskFn(pred);
            const rowBg    = level === "alto"
              ? "bg-red-50/60 hover:bg-red-50"
              : "hover:bg-slate-50/80";

            return (
              <tr key={alumno.id} className={`transition-colors ${rowBg}`}>
                {/* Alumno */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-slate-900">{alumno.nombre_completo}</span>
                    <RiskLevelBadge level={loading ? "sin_datos" : level} />
                  </div>
                </td>
                {/* Asistencia */}
                <td className="px-4 py-3">
                  <AsistenciaCel value={alumno.ultima_asistencia} />
                </td>
                {/* Veces cursada */}
                <td className="px-4 py-3">
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    {getBadgeByAttempts(alumno.veces_cursada)}
                  </span>
                </td>
                {/* Abandono */}
                {userRole !== "docente" && (
                  <td className="px-4 py-3">
                    <ProbCel value={pred?.abandono?.probabilidad} loading={loading} />
                  </td>
                )}
                {/* Recursado */}
                <td className="px-4 py-3">
                  <ProbCel value={pred?.recursado?.probabilidad} loading={loading} />
                </td>
                {/* Nota */}
                <td className="px-4 py-3">
                  <NotaCel value={pred?.nota?.nota} loading={loading} />
                </td>
                {/* Acción */}
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onViewDetail(alumno.id)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    Ver detalles →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const FILTROS_RIESGO = [
  { key: "todos",     label: "Todos" },
  { key: "alto",      label: "🔴 Alto riesgo" },
  { key: "medio",     label: "🟡 Medio riesgo" },
  { key: "bajo",      label: "🟢 Bajo riesgo" },
  { key: "sin_datos", label: "⚪ Sin datos" },
];

export default function PanelPredicciones() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [materias,            setMaterias]            = useState([]);
  const [materiaActiva,       setMateriaActiva]       = useState(null);
  const [datos,               setDatos]               = useState(null);
  const [predicciones,        setPredicciones]        = useState({});
  const [loading,             setLoading]             = useState(false);
  const [loadingPredicciones, setLoadingPredicciones] = useState(false);
  const [error,               setError]               = useState("");
  const [busqueda,            setBusqueda]            = useState("");
  const [filtroRiesgo,        setFiltroRiesgo]        = useState("todos");

  const activeMateriaRef = useRef(null);
  const getRiskFn = user?.role === "docente" ? getRecursadoRiskLevel : getRiskLevel;

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
        if (active) setError(fetchError.message || "No se pudo cargar el panel de predicciones.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadMaterias();
    return () => { active = false; };
  }, []);

  const cargarAlumnos = async (materiaId, materiasRef = materias) => {
    activeMateriaRef.current = materiaId;
    setLoading(true);
    setError("");
    setPredicciones({});
    setBusqueda("");
    setFiltroRiesgo("todos");

    try {
      const response = await api.get(
        `/api/panel-predicciones/materias/${materiaId}/panel-predicciones?skipPredicciones=true`,
      );
      if (activeMateriaRef.current !== materiaId) return;

      setDatos(response.data);
      const selected = (materiasRef || []).find((m) => Number(m.id) === Number(materiaId));
      setMateriaActiva(selected || response.data?.materia || null);
      setLoading(false);

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
            setPredicciones((prev) => ({ ...prev, ...predResp.data.predicciones }));
          }
        } catch {
          // predicciones son opcionales
        } finally {
          if (activeMateriaRef.current === materiaId) setLoadingPredicciones(false);
        }
      }
    } catch (fetchError) {
      if (activeMateriaRef.current === materiaId) {
        setError(fetchError.message || "No se pudieron cargar los alumnos.");
        setLoading(false);
      }
    }
  };

  // Alumnos con predicciones mergeadas
  const alumnosConPred = useMemo(() => {
    return (datos?.cursando || []).map((a) => ({
      ...a,
      prediccion: predicciones[a.id] ?? null,
    }));
  }, [datos, predicciones]);

  // KPIs de riesgo
  const kpis = useMemo(() => {
    const counts = { alto: 0, medio: 0, bajo: 0, sin_datos: 0 };
    for (const a of alumnosConPred) {
      const level = getRiskFn(a.prediccion);
      counts[level] = (counts[level] ?? 0) + 1;
    }
    return counts;
  }, [alumnosConPred, getRiskFn]);

  // Filtrado por nombre + riesgo
  const alumnosFiltrados = useMemo(() => {
    let lista = alumnosConPred;
    if (busqueda.trim()) {
      lista = lista.filter((a) =>
        a.nombre_completo.toLowerCase().includes(busqueda.trim().toLowerCase()),
      );
    }
    if (filtroRiesgo !== "todos") {
      lista = lista.filter((a) => getRiskFn(a.prediccion) === filtroRiesgo);
    }
    return lista;
  }, [alumnosConPred, busqueda, filtroRiesgo, getRiskFn]);

  return (
    <div className="space-y-5">

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Selector de materia + búsqueda */}
      {materias.length > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
          <label htmlFor="materia-select" className="text-sm font-medium text-slate-700 whitespace-nowrap">
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
              <option key={materia.id} value={materia.id}>{materia.nombre}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none text-sm">🔍</span>
            <input
              type="text"
              placeholder="Buscar alumno..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </section>
      )}

      {/* KPIs + estado de carga */}
      {datos && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <article className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Total cursando</p>
            <p className="text-2xl font-bold text-slate-900">{datos.resumen.total}</p>
          </article>
          <article className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600">{user?.role === "docente" ? "Alto riesgo de recursar" : "Alto riesgo"}</p>
            <p className="text-2xl font-bold text-red-700">{loadingPredicciones ? "…" : kpis.alto}</p>
          </article>
          <article className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs text-amber-600">{user?.role === "docente" ? "Medio riesgo de recursar" : "Medio riesgo"}</p>
            <p className="text-2xl font-bold text-amber-700">{loadingPredicciones ? "…" : kpis.medio}</p>
          </article>
          <article className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-xs text-green-600">{user?.role === "docente" ? "Bajo riesgo de recursar" : "Bajo riesgo"}</p>
            <p className="text-2xl font-bold text-green-700">{loadingPredicciones ? "…" : kpis.bajo}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-2">
            {loadingPredicciones ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent flex-shrink-0" />
                <p className="text-xs text-blue-600">Calculando predicciones…</p>
              </>
            ) : (
              <p className="text-xs text-slate-500">Predicciones listas ✓</p>
            )}
          </article>
        </section>
      )}

      {/* Filtros rápidos de riesgo */}
      {datos && !loadingPredicciones && (
        <div className="flex flex-wrap gap-2">
          {FILTROS_RIESGO.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFiltroRiesgo(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                filtroRiesgo === key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              {label}
              {key !== "todos" && (
                <span className="ml-1 opacity-70">({kpis[key] ?? 0})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lista / tabla */}
      {loading ? (
        <LoadingSpinner size="md" text="Cargando alumnos..." />
      ) : datos ? (
        <section>
          {(datos.cursando?.length ?? 0) > 0 ? (
            <>
              <p className="mb-3 text-sm text-slate-500">
                Mostrando{" "}
                <span className="font-semibold text-slate-700">{alumnosFiltrados.length}</span>
                {alumnosFiltrados.length !== datos.cursando.length && (
                  <> de <span className="font-semibold text-slate-700">{datos.cursando.length}</span></>
                )}{" "}
                alumno{alumnosFiltrados.length !== 1 ? "s" : ""}.
                {" "}Hacé click en un encabezado para ordenar.
              </p>

              {alumnosFiltrados.length > 0 ? (
                <TablaAlumnos
                  alumnos={alumnosFiltrados}
                  predicciones={predicciones}
                  loadingPredicciones={loadingPredicciones}
                  onViewDetail={(id) => navigate(`/alumnos/${id}`)}
                  userRole={user?.role}
                  getRiskFn={getRiskFn}
                />
              ) : (
                <p className="text-sm text-slate-500 rounded-xl border border-slate-200 bg-white p-4">
                  No se encontraron alumnos con ese criterio.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500 rounded-xl border border-slate-200 bg-white p-4">
              No hay alumnos cursando esta materia actualmente.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
