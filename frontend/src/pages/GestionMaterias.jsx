import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR").format(date);
}

function StatusChip({ active }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-100 text-emerald-700"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {active ? "Activo" : "Historial"}
    </span>
  );
}

export default function GestionMaterias() {
  const [tab, setTab] = useState("asignaciones");

  const [loadingAsignaciones, setLoadingAsignaciones] = useState(true);
  const [loadingPeriodos, setLoadingPeriodos] = useState(true);
  const [error, setError] = useState("");

  const [asignaciones, setAsignaciones] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [materiasDisponibles, setMateriasDisponibles] = useState([]);
  const [periodos, setPeriodos] = useState([]);

  const [anioFiltro, setAnioFiltro] = useState("todos");

  const [openNuevaAsignacion, setOpenNuevaAsignacion] = useState(false);
  const [nuevaAsignacion, setNuevaAsignacion] = useState({
    docente_id: "",
    materia_id: "",
    anio: String(new Date().getFullYear()),
  });
  const [asignacionError, setAsignacionError] = useState("");
  const [savingAsignacion, setSavingAsignacion] = useState(false);
  const [desasignarTarget, setDesasignarTarget] = useState(null);

  const [openNuevoPeriodo, setOpenNuevoPeriodo] = useState(false);
  const [nuevoPeriodo, setNuevoPeriodo] = useState({
    anio: String(new Date().getFullYear()),
    descripcion: "",
    fecha_inicio: "",
    fecha_fin: "",
    activo: true,
  });
  const [periodoError, setPeriodoError] = useState("");
  const [savingPeriodo, setSavingPeriodo] = useState(false);
  const [activarTarget, setActivarTarget] = useState(null);
  const [eliminarTarget, setEliminarTarget] = useState(null);

  const aniosDisponibles = useMemo(() => {
    const years = new Set(asignaciones.map((item) => Number(item.anio)));
    return Array.from(years).sort((a, b) => b - a);
  }, [asignaciones]);

  const asignacionesFiltradas = useMemo(() => {
    if (anioFiltro === "todos") return asignaciones;
    return asignaciones.filter(
      (item) => Number(item.anio) === Number(anioFiltro),
    );
  }, [anioFiltro, asignaciones]);

  const loadAsignacionesData = async () => {
    setLoadingAsignaciones(true);
    setError("");

    try {
      const [asignacionesRes, docentesRes, materiasRes] = await Promise.all([
        api.get("/api/gestion/asignaciones"),
        api.get("/api/gestion/docentes"),
        api.get("/api/gestion/materias-disponibles"),
      ]);

      setAsignaciones(asignacionesRes.data || []);
      setDocentes(docentesRes.data || []);
      setMateriasDisponibles(materiasRes.data || []);
    } catch (fetchError) {
      setError(
        fetchError.message || "No se pudo cargar la gestión de asignaciones.",
      );
    } finally {
      setLoadingAsignaciones(false);
    }
  };

  const loadPeriodosData = async () => {
    setLoadingPeriodos(true);
    setError("");

    try {
      const response = await api.get("/api/gestion/periodos");
      setPeriodos(response.data || []);
    } catch (fetchError) {
      setError(fetchError.message || "No se pudieron cargar los períodos.");
    } finally {
      setLoadingPeriodos(false);
    }
  };

  useEffect(() => {
    loadAsignacionesData();
    loadPeriodosData();
  }, []);

  const handleCrearAsignacion = async (event) => {
    event.preventDefault();
    setSavingAsignacion(true);
    setAsignacionError("");

    if (
      !nuevaAsignacion.docente_id ||
      !nuevaAsignacion.materia_id ||
      !nuevaAsignacion.anio
    ) {
      setAsignacionError("Completá todos los campos obligatorios.");
      setSavingAsignacion(false);
      return;
    }

    try {
      await api.post("/api/gestion/asignaciones", {
        docente_id: Number(nuevaAsignacion.docente_id),
        materia_id: Number(nuevaAsignacion.materia_id),
        anio: Number(nuevaAsignacion.anio),
      });

      setOpenNuevaAsignacion(false);
      setNuevaAsignacion({
        docente_id: "",
        materia_id: "",
        anio: String(new Date().getFullYear()),
      });
      await loadAsignacionesData();
    } catch (saveError) {
      setAsignacionError(
        saveError.message ||
          "Este docente ya está asignado a esta materia para ese año.",
      );
    } finally {
      setSavingAsignacion(false);
    }
  };

  const handleDesasignar = async () => {
    if (!desasignarTarget) return;

    try {
      await api.delete(`/api/gestion/asignaciones/${desasignarTarget.id}`);
      setDesasignarTarget(null);
      await loadAsignacionesData();
    } catch (actionError) {
      setError(actionError.message || "No se pudo desasignar el docente.");
    }
  };

  const handleCrearPeriodo = async (event) => {
    event.preventDefault();
    setSavingPeriodo(true);
    setPeriodoError("");

    const start = new Date(`${nuevoPeriodo.fecha_inicio}T00:00:00`);
    const end = new Date(`${nuevoPeriodo.fecha_fin}T00:00:00`);

    if (
      !nuevoPeriodo.anio ||
      !nuevoPeriodo.fecha_inicio ||
      !nuevoPeriodo.fecha_fin ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      setPeriodoError("Completá año, fecha de inicio y fecha de fin.");
      setSavingPeriodo(false);
      return;
    }

    if (end <= start) {
      setPeriodoError(
        "La fecha de fin debe ser posterior a la fecha de inicio.",
      );
      setSavingPeriodo(false);
      return;
    }

    try {
      await api.post("/api/gestion/periodos", {
        anio: Number(nuevoPeriodo.anio),
        descripcion: nuevoPeriodo.descripcion,
        fecha_inicio: nuevoPeriodo.fecha_inicio,
        fecha_fin: nuevoPeriodo.fecha_fin,
        activo: Boolean(nuevoPeriodo.activo),
      });

      setOpenNuevoPeriodo(false);
      setNuevoPeriodo({
        anio: String(new Date().getFullYear()),
        descripcion: "",
        fecha_inicio: "",
        fecha_fin: "",
        activo: true,
      });
      await loadPeriodosData();
    } catch (saveError) {
      setPeriodoError(saveError.message || "No se pudo crear el período.");
    } finally {
      setSavingPeriodo(false);
    }
  };

  const handleActivarPeriodo = async () => {
    if (!activarTarget) return;
    try {
      await api.patch(`/api/gestion/periodos/${activarTarget.id}/activar`);
      setActivarTarget(null);
      await loadPeriodosData();
    } catch (actionError) {
      setError(actionError.message || "No se pudo activar el período.");
    }
  };

  const handleDesactivarPeriodo = async (periodoId) => {
    try {
      await api.patch(`/api/gestion/periodos/${periodoId}/desactivar`);
      await loadPeriodosData();
    } catch (actionError) {
      setError(actionError.message || "No se pudo desactivar el período.");
    }
  };

  const handleEliminarPeriodo = async () => {
    if (!eliminarTarget) return;

    try {
      await api.delete(`/api/gestion/periodos/${eliminarTarget.id}`);
      setEliminarTarget(null);
      await loadPeriodosData();
    } catch (actionError) {
      setError(
        actionError.message ||
          "No se puede eliminar un período con inscripciones asociadas.",
      );
    }
  };

  const yearOptions = [
    new Date().getFullYear() - 1,
    new Date().getFullYear(),
    new Date().getFullYear() + 1,
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-2 sm:p-4">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "asignaciones"}
            onClick={() => setTab("asignaciones")}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === "asignaciones"
                ? "bg-blue-100 text-blue-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Asignación de docentes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "periodos"}
            onClick={() => setTab("periodos")}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === "periodos"
                ? "bg-blue-100 text-blue-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Períodos de inscripción
          </button>
        </div>
      </section>

      {error ? (
        <ErrorMessage message={error} onDismiss={() => setError("")} />
      ) : null}

      {tab === "asignaciones" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Asignación de docentes
            </h2>
            <button
              type="button"
              onClick={() => setOpenNuevaAsignacion(true)}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Nueva asignación
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="anioFiltro"
            >
              Filtrar por año
            </label>
            <select
              id="anioFiltro"
              value={anioFiltro}
              onChange={(event) => setAnioFiltro(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm md:w-60"
            >
              <option value="todos">Todos</option>
              {aniosDisponibles.map((anio) => (
                <option key={anio} value={anio}>
                  {anio}
                </option>
              ))}
            </select>
          </div>

          {loadingAsignaciones ? (
            <LoadingSpinner size="md" text="Cargando asignaciones..." />
          ) : asignacionesFiltradas.length === 0 ? (
            <EmptyState
              icon="📚"
              title="No hay asignaciones para mostrar"
              description="Creá una nueva asignación para comenzar."
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-600">
                      <th className="px-3 py-2 font-medium">Docente</th>
                      <th className="px-3 py-2 font-medium">Materia</th>
                      <th className="px-3 py-2 font-medium">Año</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 font-medium text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {asignacionesFiltradas.map((item) => (
                      <tr key={item.id}>
                        <td className="border-t border-slate-100 px-3 py-2">
                          {item.docente_nombre}
                        </td>
                        <td className="border-t border-slate-100 px-3 py-2">
                          {item.materia_codigo} - {item.materia_nombre}
                        </td>
                        <td className="border-t border-slate-100 px-3 py-2">
                          {item.anio}
                        </td>
                        <td className="border-t border-slate-100 px-3 py-2">
                          <StatusChip active={Number(item.activo) === 1} />
                        </td>
                        <td className="border-t border-slate-100 px-3 py-2 text-right">
                          {Number(item.activo) === 1 ? (
                            <button
                              type="button"
                              onClick={() => setDesasignarTarget(item)}
                              className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                              X
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-3 md:hidden">
                {asignacionesFiltradas.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.docente_nombre}
                        </p>
                        <p className="text-sm text-slate-600">
                          {item.materia_codigo} - {item.materia_nombre}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Año {item.anio}
                        </p>
                      </div>
                      <StatusChip active={Number(item.activo) === 1} />
                    </div>
                    {Number(item.activo) === 1 ? (
                      <button
                        type="button"
                        onClick={() => setDesasignarTarget(item)}
                        className="mt-3 rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700"
                      >
                        Desasignar
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Períodos de inscripción
            </h2>
            <button
              type="button"
              onClick={() => setOpenNuevoPeriodo(true)}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Nuevo período
            </button>
          </div>

          {loadingPeriodos ? (
            <LoadingSpinner size="md" text="Cargando períodos..." />
          ) : periodos.length === 0 ? (
            <EmptyState
              icon="🗓️"
              title="No hay períodos creados"
              description="Creá un período para habilitar inscripciones."
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-600">
                      <th className="px-3 py-2 font-medium">Descripción</th>
                      <th className="px-3 py-2 font-medium">Inicio</th>
                      <th className="px-3 py-2 font-medium">Fin</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 font-medium text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodos.map((periodo) => (
                      <tr key={periodo.id}>
                        <td className="border-t border-slate-100 px-3 py-2">
                          {periodo.descripcion || `Período ${periodo.anio}`}
                        </td>
                        <td className="border-t border-slate-100 px-3 py-2">
                          {formatDate(periodo.fecha_inicio)}
                        </td>
                        <td className="border-t border-slate-100 px-3 py-2">
                          {formatDate(periodo.fecha_fin)}
                        </td>
                        <td className="border-t border-slate-100 px-3 py-2">
                          <StatusChip active={Number(periodo.activo) === 1} />
                        </td>
                        <td className="border-t border-slate-100 px-3 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            {Number(periodo.activo) === 1 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDesactivarPeriodo(periodo.id)
                                }
                                className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Desactivar
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setActivarTarget(periodo)}
                                  className="rounded border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                                >
                                  Activar
                                </button>
                                {Number(
                                  periodo.inscripciones_asociadas || 0,
                                ) === 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => setEliminarTarget(periodo)}
                                    className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                  >
                                    🗑
                                  </button>
                                ) : null}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-3 md:hidden">
                {periodos.map((periodo) => (
                  <article
                    key={periodo.id}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {periodo.descripcion || `Período ${periodo.anio}`}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatDate(periodo.fecha_inicio)} -{" "}
                      {formatDate(periodo.fecha_fin)}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <StatusChip active={Number(periodo.activo) === 1} />
                      {Number(periodo.activo) === 1 ? (
                        <button
                          type="button"
                          onClick={() => handleDesactivarPeriodo(periodo.id)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setActivarTarget(periodo)}
                            className="rounded border border-blue-200 px-2 py-1 text-xs text-blue-700"
                          >
                            Activar
                          </button>
                          {Number(periodo.inscripciones_asociadas || 0) ===
                          0 ? (
                            <button
                              type="button"
                              onClick={() => setEliminarTarget(periodo)}
                              className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                            >
                              🗑
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {openNuevaAsignacion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Nueva asignación
            </h3>
            {asignacionError ? (
              <ErrorMessage
                message={asignacionError}
                onDismiss={() => setAsignacionError("")}
              />
            ) : null}

            <form className="mt-4 space-y-3" onSubmit={handleCrearAsignacion}>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Docente
                </label>
                <select
                  value={nuevaAsignacion.docente_id}
                  onChange={(event) =>
                    setNuevaAsignacion((prev) => ({
                      ...prev,
                      docente_id: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleccioná un docente</option>
                  {docentes.map((docente) => (
                    <option key={docente.id} value={docente.id}>
                      {(docente.nombre_completo ||
                        docente.email ||
                        `Docente ${docente.id}`) +
                        ` (${Number(docente.materias_activas || 0)} materias)`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Materia
                </label>
                <select
                  value={nuevaAsignacion.materia_id}
                  onChange={(event) =>
                    setNuevaAsignacion((prev) => ({
                      ...prev,
                      materia_id: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleccioná una materia</option>
                  {materiasDisponibles.map((materia) => (
                    <option key={materia.id} value={materia.id}>
                      {materia.codigo} - {materia.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Año
                </label>
                <select
                  value={nuevaAsignacion.anio}
                  onChange={(event) =>
                    setNuevaAsignacion((prev) => ({
                      ...prev,
                      anio: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenNuevaAsignacion(false)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAsignacion}
                  className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingAsignacion ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {openNuevoPeriodo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Nuevo período
            </h3>
            {periodoError ? (
              <ErrorMessage
                message={periodoError}
                onDismiss={() => setPeriodoError("")}
              />
            ) : null}

            <form className="mt-4 space-y-3" onSubmit={handleCrearPeriodo}>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Año
                </label>
                <input
                  type="number"
                  value={nuevoPeriodo.anio}
                  onChange={(event) =>
                    setNuevoPeriodo((prev) => ({
                      ...prev,
                      anio: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Descripción
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={nuevoPeriodo.descripcion}
                  onChange={(event) =>
                    setNuevoPeriodo((prev) => ({
                      ...prev,
                      descripcion: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    value={nuevoPeriodo.fecha_inicio}
                    onChange={(event) =>
                      setNuevoPeriodo((prev) => ({
                        ...prev,
                        fecha_inicio: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    value={nuevoPeriodo.fecha_fin}
                    onChange={(event) =>
                      setNuevoPeriodo((prev) => ({
                        ...prev,
                        fecha_fin: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={nuevoPeriodo.activo}
                  onChange={(event) =>
                    setNuevoPeriodo((prev) => ({
                      ...prev,
                      activo: event.target.checked,
                    }))
                  }
                />
                Activar inmediatamente
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenNuevoPeriodo(false)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPeriodo}
                  className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingPeriodo ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {desasignarTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Confirmar desasignación
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              ¿Confirmás que querés desasignar a{" "}
              {desasignarTarget.docente_nombre} de{" "}
              {desasignarTarget.materia_codigo}?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDesasignarTarget(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDesasignar}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Desasignar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activarTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Confirmar activación
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Al activar este período se desactivará el período activo actual.
              ¿Confirmás?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActivarTarget(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleActivarPeriodo}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Activar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {eliminarTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Eliminar período
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              ¿Confirmás que querés eliminar este período de inscripción?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEliminarTarget(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEliminarPeriodo}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
