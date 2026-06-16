import { useEffect, useState } from "react";
import api from "../../api/axios";

const currentYear = new Date().getFullYear();

const inputClass =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function MateriaForm({
  onResult,
  isLoading = false,
  onPredictStart,
  onPredictEnd,
  onPredictError,
}) {
  const [alumnos, setAlumnos] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [alumnoId, setAlumnoId] = useState("");
  const [materiaId, setMateriaId] = useState("");
  const [anio, setAnio] = useState(String(currentYear));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    api
      .get("/api/gestion-alumnos/alumnos")
      .then((res) => setAlumnos(res.data || []))
      .catch(() => setAlumnos([]));
    api
      .get("/api/gestion/materias")
      .then((res) => setMaterias(res.data || []))
      .catch(() => setMaterias([]));
  }, []);

  const submitDisabled = isLoading || isSubmitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    onResult?.(null);
    onPredictError?.("");

    if (!alumnoId || !materiaId || !anio) {
      setErrorMessage("Completá todos los campos.");
      return;
    }

    onPredictStart?.();
    setIsSubmitting(true);

    try {
      const response = await api.post("/api/predict/materia-smart", {
        alumnoId: Number(alumnoId),
        materiaId: Number(materiaId),
        anio: Number(anio),
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
          Predicción de recursado
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Seleccioná el alumno, la materia y el año de cursada. Los indicadores
          se calculan automáticamente desde el historial registrado.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
        <div>
          <label htmlFor="alumnoId" className="text-sm font-medium text-slate-700">
            Alumno
          </label>
          <select
            id="alumnoId"
            value={alumnoId}
            onChange={(e) => setAlumnoId(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">-- Seleccionar alumno --</option>
            {alumnos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre_completo} ({a.email})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="materiaId" className="text-sm font-medium text-slate-700">
            Materia
          </label>
          <select
            id="materiaId"
            value={materiaId}
            onChange={(e) => setMateriaId(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">-- Seleccionar materia --</option>
            {materias.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codigo} — {m.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="anio" className="text-sm font-medium text-slate-700">
            Año de cursada
          </label>
          <input
            id="anio"
            type="number"
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            min="2000"
            max={currentYear}
            className={inputClass}
            required
          />
        </div>
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
