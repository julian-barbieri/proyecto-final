import { useState } from "react";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import AbandonoResult from "../components/predictions/AbandonoResult";
import AlumnoForm from "../components/predictions/AlumnoForm";
import ExamenForm from "../components/predictions/ExamenForm";
import MateriaForm from "../components/predictions/MateriaForm";
import NotaResult from "../components/predictions/NotaResult";
import RecursadoResult from "../components/predictions/RecursadoResult";

const TABS = [
  {
    id: "abandono",
    label: "Abandono de carrera",
    description:
      "Predice riesgo de abandono académico a partir de indicadores del alumno.",
  },
  {
    id: "recursado",
    label: "Recursado de materia",
    description:
      "Estima si un alumno tiene riesgo de recursar la materia seleccionada.",
  },
  {
    id: "nota",
    label: "Nota de examen",
    description:
      "Proyecta la nota esperada del examen según el historial del estudiante.",
  },
];

export default function Predicciones() {
  const [activeTab, setActiveTab] = useState("abandono");
  const [abandonoResult, setAbandonoResult] = useState(null);
  const [abandonoError, setAbandonoError] = useState("");
  const [abandonoLoading, setAbandonoLoading] = useState(false);

  const [recursadoResult, setRecursadoResult] = useState(null);
  const [recursadoError, setRecursadoError] = useState("");
  const [recursadoLoading, setRecursadoLoading] = useState(false);

  const [notaResult, setNotaResult] = useState(null);
  const [notaError, setNotaError] = useState("");
  const [notaLoading, setNotaLoading] = useState(false);

  const startAbandonoPrediction = () => {
    setAbandonoError("");
    setAbandonoResult(null);
    setAbandonoLoading(true);
  };

  const startRecursadoPrediction = () => {
    setRecursadoError("");
    setRecursadoResult(null);
    setRecursadoLoading(true);
  };

  const startNotaPrediction = () => {
    setNotaError("");
    setNotaResult(null);
    setNotaLoading(true);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Predicciones</h2>
        <p className="mt-2 text-slate-600">
          Evaluá riesgo de abandono, recursado y nota de examen cargando la
          información académica del alumno.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-2 sm:p-4">
        <div
          role="tablist"
          aria-label="Tipos de predicciones"
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-blue-100 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "abandono" && (
        <section
          role="tabpanel"
          id="panel-abandono"
          aria-labelledby="tab-abandono"
          className="space-y-4"
        >
          <p className="text-sm text-slate-600">
            {TABS.find((tab) => tab.id === "abandono")?.description}
          </p>

          <AlumnoForm
            onResult={setAbandonoResult}
            isLoading={abandonoLoading}
            onPredictStart={startAbandonoPrediction}
            onPredictEnd={() => setAbandonoLoading(false)}
            onPredictError={setAbandonoError}
          />

          {abandonoLoading && (
            <LoadingSpinner size="md" text="Prediciendo abandono..." />
          )}
          {abandonoError && (
            <ErrorMessage
              message={abandonoError}
              onDismiss={() => setAbandonoError("")}
            />
          )}
          {abandonoResult && !abandonoLoading && (
            <AbandonoResult result={abandonoResult} />
          )}
        </section>
      )}

      {activeTab === "recursado" && (
        <section
          role="tabpanel"
          id="panel-recursado"
          aria-labelledby="tab-recursado"
          className="space-y-4"
        >
          <p className="text-sm text-slate-600">
            {TABS.find((tab) => tab.id === "recursado")?.description}
          </p>

          <MateriaForm
            onResult={setRecursadoResult}
            isLoading={recursadoLoading}
            onPredictStart={startRecursadoPrediction}
            onPredictEnd={() => setRecursadoLoading(false)}
            onPredictError={setRecursadoError}
          />

          {recursadoLoading && (
            <LoadingSpinner size="md" text="Prediciendo recursado..." />
          )}
          {recursadoError && (
            <ErrorMessage
              message={recursadoError}
              onDismiss={() => setRecursadoError("")}
            />
          )}
          {recursadoResult && !recursadoLoading && (
            <RecursadoResult result={recursadoResult} />
          )}
        </section>
      )}

      {activeTab === "nota" && (
        <section
          role="tabpanel"
          id="panel-nota"
          aria-labelledby="tab-nota"
          className="space-y-4"
        >
          <p className="text-sm text-slate-600">
            {TABS.find((tab) => tab.id === "nota")?.description}
          </p>

          <ExamenForm
            onResult={setNotaResult}
            isLoading={notaLoading}
            onPredictStart={startNotaPrediction}
            onPredictEnd={() => setNotaLoading(false)}
            onPredictError={setNotaError}
          />

          {notaLoading && (
            <LoadingSpinner size="md" text="Prediciendo nota..." />
          )}
          {notaError && (
            <ErrorMessage
              message={notaError}
              onDismiss={() => setNotaError("")}
            />
          )}
          {notaResult && !notaLoading && <NotaResult result={notaResult} />}
        </section>
      )}
    </div>
  );
}
