import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import LoadingSpinner from "../components/LoadingSpinner";
import AbandonoResult from "../components/predictions/AbandonoResult";
import AlumnoForm from "../components/predictions/AlumnoForm";
import ExamenForm from "../components/predictions/ExamenForm";
import MateriaForm from "../components/predictions/MateriaForm";
import NotaResult from "../components/predictions/NotaResult";
import RecursadoResult from "../components/predictions/RecursadoResult";

const TABS = [
  { id: "abandono", label: "Riesgo de abandono" },
  { id: "recursado", label: "Riesgo de recursado" },
  { id: "examen", label: "Nota de examen" },
];

function RiskChip({ result, tipo }) {
  if (!result) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
        Sin evaluar
      </span>
    );
  }
  if (tipo === "abandono") {
    return result.Abandona ? (
      <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
        En riesgo
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
        Sin riesgo
      </span>
    );
  }
  if (tipo === "recursado") {
    return result.Recursa ? (
      <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
        Puede recursar
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
        No recursará
      </span>
    );
  }
  if (tipo === "examen") {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
        Nota: {Number(result.Nota).toFixed(2)}
      </span>
    );
  }
  return null;
}

export default function AlumnoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [alumno, setAlumno] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("abandono");
  const [abandonoResult, setAbandonoResult] = useState(null);
  const [recursadoResult, setRecursadoResult] = useState(null);
  const [examenResult, setExamenResult] = useState(null);

  useEffect(() => {
    api
      .get(`/api/students/${id}`)
      .then((res) => setAlumno(res.data))
      .catch((err) => setError(err.message || "Error al cargar el alumno"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" text="Cargando alumno..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/alumnos")}
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          ← Volver al listado
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  const alumnoInitialData = {
    Genero: String(alumno.Genero),
    Edad: String(alumno.Edad),
    AyudaFinanciera: String(alumno.AyudaFinanciera),
    ColegioTecnico: String(alumno.ColegioTecnico),
    AnioIngreso: String(alumno.AnioIngreso),
    PromedioColegio: String(alumno.PromedioColegio),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <button
          onClick={() => navigate("/alumnos")}
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          ← Volver al listado
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {alumno.Nombre}
              </h1>
              <p className="mt-1 font-mono text-sm text-slate-500">
                {alumno.IdAlumno}
              </p>
            </div>

            {/* Risk indicators */}
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-slate-400">Abandono</span>
                <RiskChip result={abandonoResult} tipo="abandono" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-slate-400">Recursado</span>
                <RiskChip result={recursadoResult} tipo="recursado" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-slate-400">Nota examen</span>
                <RiskChip result={examenResult} tipo="examen" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex border-b border-slate-200" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors sm:flex-none sm:px-6 ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "abandono" && (
            <div className="space-y-6">
              <AlumnoForm
                initialData={alumnoInitialData}
                onResult={setAbandonoResult}
              />
              {abandonoResult && <AbandonoResult result={abandonoResult} />}
            </div>
          )}

          {activeTab === "recursado" && (
            <div className="space-y-6">
              <MateriaForm
                initialData={alumnoInitialData}
                onResult={setRecursadoResult}
              />
              {recursadoResult && <RecursadoResult result={recursadoResult} />}
            </div>
          )}

          {activeTab === "examen" && (
            <div className="space-y-6">
              <ExamenForm
                initialData={alumnoInitialData}
                onResult={setExamenResult}
              />
              {examenResult && <NotaResult result={examenResult} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
