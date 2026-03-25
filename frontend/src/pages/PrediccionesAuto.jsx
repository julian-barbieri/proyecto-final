import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import AbandonoResult from "../components/predictions/AbandonoResult";
import NotaResult from "../components/predictions/NotaResult";
import RecursadoResult from "../components/predictions/RecursadoResult";

const TABS = [
  { id: "individual", label: "Individual" },
  { id: "masiva", label: "Masiva" },
];

const MASSIVE_TYPES = [
  { id: "abandono", label: "Abandono" },
  { id: "recursado", label: "Recursado" },
  { id: "examen", label: "Nota examen" },
];

function statusClassByMassiveResult(type, row) {
  if (type === "abandono") {
    return row.Abandona ? "bg-red-50" : "bg-emerald-50";
  }
  if (type === "recursado") {
    return row.Recursa ? "bg-orange-50" : "bg-emerald-50";
  }
  return "bg-slate-50";
}

export default function PrediccionesAuto() {
  const [activeTab, setActiveTab] = useState("individual");
  const [materias, setMaterias] = useState([]);
  const [loadingMaterias, setLoadingMaterias] = useState(true);

  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedAlumno, setSelectedAlumno] = useState(null);

  const [anioRecursado, setAnioRecursado] = useState(new Date().getFullYear());
  const [materiaRecursado, setMateriaRecursado] = useState("");

  const [anioExamen, setAnioExamen] = useState(new Date().getFullYear());
  const [materiaExamen, setMateriaExamen] = useState("");
  const [tipoExamen, setTipoExamen] = useState("Parcial");
  const [instanciaExamen, setInstanciaExamen] = useState(1);

  const [runningAction, setRunningAction] = useState("");
  const [individualResultType, setIndividualResultType] = useState("");
  const [individualResult, setIndividualResult] = useState(null);
  const [variablesPayload, setVariablesPayload] = useState(null);
  const [warningMessage, setWarningMessage] = useState("");

  const [massiveType, setMassiveType] = useState("abandono");
  const [massiveMateriaId, setMassiveMateriaId] = useState("");
  const [massiveAnio, setMassiveAnio] = useState(new Date().getFullYear());
  const [massiveTipoExamen, setMassiveTipoExamen] = useState("Parcial");
  const [massiveInstancia, setMassiveInstancia] = useState(1);
  const [massiveRunning, setMassiveRunning] = useState(false);
  const [massiveResponse, setMassiveResponse] = useState(null);

  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }).map((_, idx) => current - idx);
  }, []);

  const instanciaOptions = useMemo(() => {
    if (tipoExamen === "Final") {
      return [1, 2, 3];
    }
    return [1, 2];
  }, [tipoExamen]);

  const massiveInstanciaOptions = useMemo(() => {
    if (massiveTipoExamen === "Final") {
      return [1, 2, 3];
    }
    return [1, 2];
  }, [massiveTipoExamen]);

  useEffect(() => {
    const loadMaterias = async () => {
      setLoadingMaterias(true);
      try {
        const response = await api.get("/api/gestion-contenido/materias");
        const list = response.data || [];
        setMaterias(list);

        if (list[0]) {
          setMateriaRecursado(String(list[0].id));
          setMateriaExamen(String(list[0].id));
          setMassiveMateriaId(String(list[0].id));
        }
      } catch (fetchError) {
        setError(fetchError.message || "No se pudieron cargar las materias.");
      } finally {
        setLoadingMaterias(false);
      }
    };

    loadMaterias();
  }, []);

  useEffect(() => {
    const text = searchText.trim();

    if (text.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.get("/api/predicciones-auto/alumnos", {
          params: { q: text },
        });
        setSearchResults(response.data || []);
      } catch (fetchError) {
        setError(fetchError.message || "No se pudo buscar alumnos.");
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [searchText]);

  const runIndividual = async (kind) => {
    if (!selectedAlumno) {
      setError("Seleccioná un alumno para predecir.");
      return;
    }

    setRunningAction(kind);
    setError("");
    setWarningMessage("");

    try {
      let response;

      if (kind === "abandono") {
        response = await api.post(
          `/api/predicciones-auto/predecir/${selectedAlumno.legajo}/abandono`,
        );
      } else if (kind === "recursado") {
        if (!materiaRecursado || !anioRecursado) {
          setError("Seleccioná materia y año para recursado.");
          return;
        }

        response = await api.post(
          `/api/predicciones-auto/predecir/${selectedAlumno.legajo}/materia/${materiaRecursado}/${anioRecursado}`,
        );
      } else {
        if (!materiaExamen || !anioExamen) {
          setError("Seleccioná materia y año para nota de examen.");
          return;
        }

        response = await api.post(
          `/api/predicciones-auto/predecir/${selectedAlumno.legajo}/examen/${materiaExamen}/${tipoExamen}/${instanciaExamen}/${anioExamen}`,
        );
      }

      setIndividualResultType(kind);
      setIndividualResult(response.data?.resultado || null);
      setVariablesPayload(response.data?.variables || null);
      setWarningMessage(response.data?.warning || "");
      setToast({
        type: "success",
        message: "Predicción generada correctamente.",
      });
    } catch (predictError) {
      setError(predictError.message || "No se pudo ejecutar la predicción.");
    } finally {
      setRunningAction("");
    }
  };

  const runMassive = async () => {
    setMassiveRunning(true);
    setError("");
    setMassiveResponse(null);

    try {
      let response;

      if (massiveType === "abandono") {
        response = await api.post(
          "/api/predicciones-auto/predecir-masivo/abandono",
          {
            materia_id: massiveMateriaId ? Number(massiveMateriaId) : undefined,
          },
        );
      } else if (massiveType === "recursado") {
        if (!massiveMateriaId || !massiveAnio) {
          setError(
            "Seleccioná materia y año para predicción masiva de recursado.",
          );
          return;
        }

        response = await api.post(
          `/api/predicciones-auto/predecir-masivo/materia/${massiveMateriaId}/${massiveAnio}`,
        );
      } else {
        if (!massiveMateriaId || !massiveAnio) {
          setError("Seleccioná materia y año para predicción masiva de nota.");
          return;
        }

        response = await api.post(
          `/api/predicciones-auto/predecir-masivo/examen/${massiveMateriaId}/${massiveTipoExamen}/${massiveInstancia}/${massiveAnio}`,
        );
      }

      setMassiveResponse(response.data);
      setToast({ type: "success", message: "Predicción masiva finalizada." });
    } catch (runError) {
      setError(runError.message || "No se pudo ejecutar la predicción masiva.");
    } finally {
      setMassiveRunning(false);
    }
  };

  const exportMassiveCsv = () => {
    if (!massiveResponse?.resultados?.length) {
      return;
    }

    const type = massiveType;
    const headersByType = {
      abandono: ["Legajo", "Nombre", "Abandona", "Probabilidad"],
      recursado: ["Legajo", "Nombre", "Recursa", "Probabilidad"],
      examen: ["Legajo", "Nombre", "Nota"],
    };

    const rows = massiveResponse.resultados.map((row) => {
      if (type === "abandono") {
        return [
          row.legajo,
          row.nombre,
          row.Abandona ? "Sí" : "No",
          Number(row.probabilidad || 0).toFixed(4),
        ];
      }
      if (type === "recursado") {
        return [
          row.legajo,
          row.nombre,
          row.Recursa ? "Sí" : "No",
          Number(row.probabilidad || 0).toFixed(4),
        ];
      }

      return [row.legajo, row.nombre, Number(row.Nota || 0).toFixed(2)];
    });

    const csv = [headersByType[type], ...rows]
      .map((line) => line.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `predicciones_${type}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Predicciones académicas
        </h2>
        <p className="mt-2 text-slate-600">
          Seleccioná un alumno y el sistema calcula automáticamente todas las
          variables para predecir.
        </p>
      </section>

      {error ? (
        <ErrorMessage message={error} onDismiss={() => setError("")} />
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-2 sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-blue-100 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {loadingMaterias ? (
        <LoadingSpinner size="md" text="Cargando materias..." />
      ) : null}

      {activeTab === "individual" ? (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <label
              className="mb-1 block text-sm font-medium text-slate-700"
              htmlFor="buscar_alumno_auto"
            >
              Buscar alumno
            </label>
            <input
              id="buscar_alumno_auto"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Nombre, apellido o legajo"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Escribí al menos 2 caracteres
            </p>
          </div>

          {searching ? (
            <LoadingSpinner size="sm" text="Buscando alumnos..." />
          ) : null}

          {!searching && searchResults.length > 0 ? (
            <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200">
              {searchResults.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setSelectedAlumno(item);
                    setSearchResults([]);
                    setSearchText(`${item.nombre_completo} (${item.legajo})`);
                  }}
                  className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span>{item.nombre_completo}</span>
                  <span className="text-xs text-slate-500">
                    Legajo {item.legajo}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {selectedAlumno ? (
            <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-800">
                Alumno: {selectedAlumno.nombre_completo} (Legajo:{" "}
                {selectedAlumno.legajo})
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={runningAction === "abandono"}
                  onClick={() => runIndividual("abandono")}
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {runningAction === "abandono"
                    ? "Prediciendo..."
                    : "🎓 Predecir abandono"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <select
                  value={materiaRecursado}
                  onChange={(event) => setMateriaRecursado(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {materias.map((materia) => (
                    <option key={materia.id} value={materia.id}>
                      {materia.codigo}
                    </option>
                  ))}
                </select>
                <select
                  value={anioRecursado}
                  onChange={(event) =>
                    setAnioRecursado(Number(event.target.value))
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={runningAction === "recursado"}
                  onClick={() => runIndividual("recursado")}
                  className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
                >
                  {runningAction === "recursado"
                    ? "Prediciendo..."
                    : "📚 Predecir recursado"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                <select
                  value={materiaExamen}
                  onChange={(event) => setMateriaExamen(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {materias.map((materia) => (
                    <option key={materia.id} value={materia.id}>
                      {materia.codigo}
                    </option>
                  ))}
                </select>
                <select
                  value={tipoExamen}
                  onChange={(event) => {
                    const nextTipo = event.target.value;
                    setTipoExamen(nextTipo);
                    setInstanciaExamen(1);
                  }}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="Parcial">Parcial</option>
                  <option value="Recuperatorio">Recuperatorio</option>
                  <option value="Final">Final</option>
                </select>
                <select
                  value={instanciaExamen}
                  onChange={(event) =>
                    setInstanciaExamen(Number(event.target.value))
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {instanciaOptions.map((value) => (
                    <option key={value} value={value}>
                      Instancia {value}
                    </option>
                  ))}
                </select>
                <select
                  value={anioExamen}
                  onChange={(event) =>
                    setAnioExamen(Number(event.target.value))
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={runningAction === "examen"}
                  onClick={() => runIndividual("examen")}
                  className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
                >
                  {runningAction === "examen"
                    ? "Prediciendo..."
                    : "📝 Predecir nota"}
                </button>
              </div>
            </div>
          ) : null}

          {warningMessage ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {warningMessage}
            </p>
          ) : null}

          {individualResultType === "abandono" && individualResult ? (
            <AbandonoResult result={individualResult} />
          ) : null}
          {individualResultType === "recursado" && individualResult ? (
            <RecursadoResult result={individualResult} />
          ) : null}
          {individualResultType === "examen" && individualResult ? (
            <NotaResult result={individualResult} />
          ) : null}

          {variablesPayload ? (
            <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                Ver variables calculadas
              </summary>
              <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(variablesPayload, null, 2)}
              </pre>
            </details>
          ) : null}
        </section>
      ) : null}

      {activeTab === "masiva" ? (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">
            Predicción masiva
          </h3>

          <div className="flex flex-wrap gap-2">
            {MASSIVE_TYPES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMassiveType(item.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  massiveType === item.id
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <select
              value={massiveMateriaId}
              onChange={(event) => setMassiveMateriaId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Todas las materias</option>
              {materias.map((materia) => (
                <option key={materia.id} value={materia.id}>
                  {materia.codigo}
                </option>
              ))}
            </select>

            {massiveType !== "abandono" ? (
              <select
                value={massiveAnio}
                onChange={(event) => setMassiveAnio(Number(event.target.value))}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            ) : (
              <div />
            )}

            {massiveType === "examen" ? (
              <select
                value={massiveTipoExamen}
                onChange={(event) => {
                  setMassiveTipoExamen(event.target.value);
                  setMassiveInstancia(1);
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Parcial">Parcial</option>
                <option value="Recuperatorio">Recuperatorio</option>
                <option value="Final">Final</option>
              </select>
            ) : (
              <div />
            )}

            {massiveType === "examen" ? (
              <select
                value={massiveInstancia}
                onChange={(event) =>
                  setMassiveInstancia(Number(event.target.value))
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {massiveInstanciaOptions.map((value) => (
                  <option key={value} value={value}>
                    Instancia {value}
                  </option>
                ))}
              </select>
            ) : (
              <div />
            )}
          </div>

          <button
            type="button"
            onClick={runMassive}
            disabled={massiveRunning}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {massiveRunning ? "Procesando..." : "▶ Ejecutar predicción masiva"}
          </button>

          {massiveRunning ? (
            <LoadingSpinner
              size="md"
              text="Procesando predicciones masivas..."
            />
          ) : null}

          {massiveResponse ? (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                ✅ {massiveResponse.procesados || 0} procesados · ❌{" "}
                {massiveResponse.errores || 0} errores
              </div>

              {(massiveResponse.resultados || []).length === 0 ? (
                <EmptyState
                  icon="📭"
                  title="No hay alumnos registrados para hacer predicción masiva."
                  description="Asegurate de tener inscripciones activas para la materia y año seleccionados."
                />
              ) : (
                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Legajo</th>
                        <th className="px-3 py-2 text-left">Nombre</th>
                        <th className="px-3 py-2 text-left">Resultado</th>
                        <th className="px-3 py-2 text-left">Prob./Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(massiveResponse.resultados || []).map((row) => (
                        <tr
                          key={`${row.legajo}-${row.nombre}`}
                          className={statusClassByMassiveResult(
                            massiveType,
                            row,
                          )}
                        >
                          <td className="px-3 py-2">{row.legajo}</td>
                          <td className="px-3 py-2">{row.nombre}</td>
                          <td className="px-3 py-2">
                            {massiveType === "abandono"
                              ? row.Abandona
                                ? "Abandona"
                                : "No abandona"
                              : massiveType === "recursado"
                                ? row.Recursa
                                  ? "Recursa"
                                  : "No recursa"
                                : "Nota predicha"}
                          </td>
                          <td className="px-3 py-2">
                            {massiveType === "examen"
                              ? Number(row.Nota || 0).toFixed(2)
                              : `${(Number(row.probabilidad || 0) * 100).toFixed(1)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(massiveResponse.resultados || []).length > 0 ? (
                <button
                  type="button"
                  onClick={exportMassiveCsv}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  ⬇ Exportar resultados como CSV
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {toast ? (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
