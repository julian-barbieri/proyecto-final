import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import MetricCard from "../components/MetricCard";

function normalizeHistoryResponse(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getPrimaryPayload(payload) {
  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }

  return payload ?? null;
}

function summarizeResult(record) {
  const result = getPrimaryPayload(record?.result_data);

  if (record.tipo === "alumno") {
    return result?.Abandona ? "Abandona" : "No abandona";
  }

  if (record.tipo === "materia") {
    return result?.Recursa ? "Recursa" : "No recursa";
  }

  if (record.tipo === "examen") {
    const nota = Number(result?.Nota ?? 0);
    return `Nota: ${nota.toFixed(2)}`;
  }

  return "Sin resultado";
}

function getTypeBadgeClass(tipo) {
  if (tipo === "alumno") {
    return "bg-blue-100 text-blue-700";
  }

  if (tipo === "materia") {
    return "bg-orange-100 text-orange-700";
  }

  return "bg-emerald-100 text-emerald-700";
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-2xl bg-slate-200"
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}

export default function Dashboard() {
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [healthStatus, setHealthStatus] = useState({
    available: false,
    message: "Verificando servicio de IA...",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setHistoryError("");

      const [historyResponse, healthResponse] = await Promise.all([
        api.get("/api/history").then(
          (response) => ({ ok: true, data: response.data }),
          (error) => ({ ok: false, error }),
        ),
        api.get("/api/predict/health").then(
          (response) => ({ ok: true, data: response.data }),
          (error) => ({ ok: false, error }),
        ),
      ]);

      if (!isMounted) {
        return;
      }

      if (historyResponse.ok) {
        setHistory(normalizeHistoryResponse(historyResponse.data));
      } else {
        setHistory([]);
        setHistoryError(
          historyResponse.error?.message ||
            "No se pudo cargar el historial de predicciones.",
        );
      }

      if (healthResponse.ok) {
        setHealthStatus({
          available: true,
          message: "Servicio de IA activo",
        });
      } else {
        setHealthStatus({
          available: false,
          message:
            "Servicio de IA no disponible — verificá que la FastAPI esté corriendo",
        });
      }

      setIsLoading(false);
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const alumnoRecords = history.filter((record) => record.tipo === "alumno");
    const materiaRecords = history.filter(
      (record) => record.tipo === "materia",
    );
    const examenRecords = history.filter((record) => record.tipo === "examen");

    const alumnosEnRiesgo = alumnoRecords.filter((record) => {
      const result = getPrimaryPayload(record.result_data);
      return Boolean(result?.Abandona);
    }).length;
    const materiasRecursa = materiaRecords.filter((record) => {
      const result = getPrimaryPayload(record.result_data);
      return Boolean(result?.Recursa);
    }).length;
    const notaPromedio = examenRecords.length
      ? examenRecords.reduce((sum, record) => {
          const result = getPrimaryPayload(record.result_data);
          return sum + Number(result?.Nota ?? 0);
        }, 0) / examenRecords.length
      : 0;

    return {
      totalPredicciones: history.length,
      alumnosEnRiesgo,
      alumnosEvaluados: alumnoRecords.length,
      tasaRecursado: materiaRecords.length
        ? (materiasRecursa / materiaRecords.length) * 100
        : 0,
      materiasEvaluadas: materiaRecords.length,
      notaPromedio,
      examenesEvaluados: examenRecords.length,
    };
  }, [history]);

  const latestPredictions = history.slice(0, 10);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <section
        className={`rounded-2xl border px-4 py-3 shadow-sm ${
          healthStatus.available
            ? "border-emerald-200 bg-emerald-50"
            : "border-red-200 bg-red-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${
              healthStatus.available ? "bg-emerald-500" : "bg-red-500"
            }`}
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-slate-800">
            {healthStatus.message}
          </p>
        </div>
      </section>

      {historyError && (
        <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {historyError}
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total de predicciones realizadas"
          value={String(metrics.totalPredicciones)}
          subtitle="Cantidad total registrada en el historial"
          color="blue"
          icon={
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          }
        />
        <MetricCard
          title="Alumnos en riesgo de abandono"
          value={String(metrics.alumnosEnRiesgo)}
          subtitle={`${metrics.alumnosEnRiesgo} de ${metrics.alumnosEvaluados} alumnos evaluados`}
          color="red"
          icon={
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86l-7.5 13A1 1 0 003.67 18h16.66a1 1 0 00.88-1.48l-7.5-13a1 1 0 00-1.76 0z"
              />
            </svg>
          }
        />
        <MetricCard
          title="Tasa de recursado estimada"
          value={`${metrics.tasaRecursado.toFixed(1)}%`}
          subtitle={`${metrics.materiasEvaluadas} materias evaluadas`}
          color="orange"
          icon={
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <MetricCard
          title="Nota promedio predicha"
          value={metrics.notaPromedio.toFixed(2)}
          subtitle={`${metrics.examenesEvaluados} exámenes evaluados`}
          color="green"
          icon={
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 5h6M11 9h6M5 5h.01M5 9h.01M7 16h10M7 20h10M5 16h.01M5 20h.01"
              />
            </svg>
          }
        />
      </section>

      {history.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl"
            aria-hidden="true"
          >
            📊
          </div>
          <h2 className="mt-4 text-xl font-semibold text-slate-900">
            Aún no hay predicciones registradas
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Comenzá desde la sección Predicciones.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Últimas predicciones realizadas
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Resumen de las 10 predicciones más recientes.
              </p>
            </div>
          </div>

          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="hidden md:table-header-group">
                <tr className="text-left text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Fecha</th>
                  <th className="pb-3 pr-4 font-medium">Tipo</th>
                  <th className="pb-3 pr-4 font-medium">Resultado</th>
                  <th className="pb-3 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {latestPredictions.map((record) => (
                  <tr key={record.id} className="text-slate-700">
                    <td className="py-4 pr-4">
                      {formatDate(record.created_at)}
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getTypeBadgeClass(record.tipo)}`}
                      >
                        {record.tipo}
                      </span>
                    </td>
                    <td className="py-4 pr-4">{summarizeResult(record)}</td>
                    <td className="py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedRecord(record)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-3 md:hidden">
            {latestPredictions.map((record) => (
              <article
                key={record.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      {formatDate(record.created_at)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {summarizeResult(record)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getTypeBadgeClass(record.tipo)}`}
                  >
                    {record.tipo}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRecord(record)}
                  className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Ver detalle
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Detalle de predicción #{selectedRecord.id}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {formatDate(selectedRecord.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar detalle"
              >
                ×
              </button>
            </div>

            <div className="grid gap-6 overflow-y-auto p-6 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-900">
                  Input
                </h4>
                <pre className="max-h-[50vh] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(selectedRecord.input_data, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-900">
                  Output
                </h4>
                <pre className="max-h-[50vh] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(selectedRecord.result_data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
