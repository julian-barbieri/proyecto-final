import { useEffect, useState } from "react";
import api from "../../api/axios";

export default function AlumnoForm({
  onResult,
  isLoading = false,
  onPredictStart,
  onPredictEnd,
  onPredictError,
}) {
  const [alumnos, setAlumnos] = useState([]);
  const [alumnoId, setAlumnoId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    api
      .get("/api/gestion-alumnos/alumnos?soloActivos=true")
      .then((res) => setAlumnos(res.data || []))
      .catch(() => setAlumnos([]));
  }, []);

  const submitDisabled = isLoading || isSubmitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    onResult?.(null);
    onPredictError?.("");

    if (!alumnoId) {
      setErrorMessage("Seleccioná un alumno.");
      return;
    }

    onPredictStart?.();
    setIsSubmitting(true);

    try {
      const response = await api.post("/api/predict/alumno-smart", {
        alumnoId: Number(alumnoId),
      });
      onResult?.(response.data);
    } catch (error) {
      const message = !error?.response
        ? "No se pudo conectar con el backend. Verificá que esté corriendo en http://localhost:3001"
        : error?.response?.data?.error || "No se pudo obtener la predicción.";
      if (onPredictError) onPredictError(message);
      else setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
      onPredictEnd?.();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Predicción de abandono
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Seleccioná un alumno para estimar el riesgo de abandono académico. Los
          indicadores se calculan automáticamente desde el historial registrado.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-5">
        <label
          htmlFor="alumnoId"
          className="text-sm font-medium text-slate-700"
        >
          Alumno
        </label>
        <select
          id="alumnoId"
          value={alumnoId}
          onChange={(e) => setAlumnoId(e.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          required
        >
          <option value="">-- Seleccionar alumno --</option>
          {alumnos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre_completo} ({a.email})
            </option>
          ))}
        </select>
      </section>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitDisabled}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {submitDisabled && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {submitDisabled ? "Prediciendo..." : "Predecir"}
        </button>
      </div>
    </form>
  );
}
