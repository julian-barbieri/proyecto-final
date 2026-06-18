import { useEffect, useState } from "react";
import api from "../../api/axios";

const inputClass =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function deriveTargetExam(proximo, aprobo) {
  if (proximo.tipoExamen !== "Parcial") {
    return proximo;
  }
  const inst = Number(proximo.instancia);
  if (aprobo) {
    if (inst === 1) return { tipoExamen: "Parcial", instancia: 2, anio: proximo.anio };
    return { tipoExamen: "Final", instancia: 1, anio: proximo.anio };
  }
  return { tipoExamen: "Recuperatorio", instancia: inst, anio: proximo.anio };
}

export default function ExamenForm({
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
  const [proximo, setProximo] = useState(null);
  const [proxLoading, setProxLoading] = useState(false);
  const [proxError, setProxError] = useState("");
  const [aproboStr, setAproboStr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    api
      .get("/api/gestion-alumnos/alumnos?soloActivos=true")
      .then((res) => setAlumnos(res.data || []))
      .catch(() => setAlumnos([]));
    api
      .get("/api/gestion/materias")
      .then((res) => setMaterias(res.data || []))
      .catch(() => setMaterias([]));
  }, []);

  useEffect(() => {
    if (!alumnoId || !materiaId) {
      setProximo(null);
      setProxError("");
      setAproboStr("");
      return;
    }

    setProxLoading(true);
    setProxError("");
    setProximo(null);
    setAproboStr("");

    api
      .get(`/api/predict/examen-proximo/${alumnoId}/${materiaId}`)
      .then((res) => {
        setProximo(res.data.proximo);
        if (!res.data.proximo) {
          setProxError(
            "No hay próximos exámenes pendientes para este alumno en esta materia.",
          );
        }
      })
      .catch(() =>
        setProxError("No se pudo determinar el próximo examen."),
      )
      .finally(() => setProxLoading(false));
  }, [alumnoId, materiaId]);

  const submitDisabled = isLoading || isSubmitting || !proximo;

  const targetExam =
    proximo && (proximo.tipoExamen !== "Parcial" || aproboStr !== "")
      ? deriveTargetExam(proximo, aproboStr === "true")
      : null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    onResult?.(null);
    onPredictError?.("");

    if (!targetExam) {
      setErrorMessage(
        proximo?.tipoExamen === "Parcial"
          ? "Indicá si el alumno aprobó o no este parcial."
          : "Seleccioná un alumno y una materia.",
      );
      return;
    }

    onPredictStart?.();
    setIsSubmitting(true);

    try {
      const response = await api.post("/api/predict/examen-smart", {
        alumnoId: Number(alumnoId),
        materiaId: Number(materiaId),
        tipoExamen: targetExam.tipoExamen,
        instancia: targetExam.instancia,
        anio: targetExam.anio,
      });

      onResult?.({
        ...response.data,
        _nextExam: response.data.examen_info
          ? {
              tipoExamen: response.data.examen_info.tipoExamen,
              instancia: response.data.examen_info.instancia,
            }
          : null,
      });
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

  const examLabel = (tipo, instancia) =>
    tipo ? `${tipo} — Instancia ${instancia}` : "";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Predicción de nota de examen
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Seleccioná el alumno y la materia. El sistema detecta automáticamente
          el próximo examen pendiente desde el historial académico.
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
            onChange={(e) => {
              setAlumnoId(e.target.value);
              onResult?.(null);
            }}
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
            onChange={(e) => {
              setMateriaId(e.target.value);
              onResult?.(null);
            }}
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

        {proxLoading && (
          <p className="text-sm text-slate-500">Buscando próximo examen...</p>
        )}

        {proxError && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {proxError}
          </p>
        )}

        {proximo && !proxLoading && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
            <span className="font-medium">Próximo examen detectado: </span>
            {examLabel(proximo.tipoExamen, proximo.instancia)}
            {proximo.anio && ` (${proximo.anio})`}
          </div>
        )}

        {proximo?.tipoExamen === "Parcial" && (
          <div>
            <label
              htmlFor="aproboStr"
              className="text-sm font-medium text-slate-700"
            >
              ¿El alumno aprobó este parcial?
            </label>
            <select
              id="aproboStr"
              value={aproboStr}
              onChange={(e) => setAproboStr(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">-- Seleccionar --</option>
              <option value="true">Sí, aprobó</option>
              <option value="false">No, desaprobó</option>
            </select>
            {targetExam && (
              <p className="mt-2 text-xs text-slate-600">
                Se predecirá:{" "}
                <span className="font-medium">
                  {examLabel(targetExam.tipoExamen, targetExam.instancia)}
                </span>
              </p>
            )}
          </div>
        )}
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
          {submitDisabled && !proximo && !proxLoading ? null : submitDisabled && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {isSubmitting ? "Prediciendo..." : "Predecir"}
        </button>
      </div>
    </form>
  );
}
