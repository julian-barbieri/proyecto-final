import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

const currentYear = new Date().getFullYear();

const initialValues = {
  Materia: "",
  Asistencia: "0.75",
  AnioIngreso: String(currentYear - 1),
  AnioCursada: String(currentYear),
  AniosDesdeIngreso: "1",
  Genero: "0",
  Edad: "20",
  AyudaFinanciera: "0",
  ColegioTecnico: "0",
  PromedioColegio: "7",
  PromedioNotaGeneral: "5",
  TasaAprobacionGeneral: "0.5",
  IndiceBloqueo: "0",
};

// Campos que se envían al modelo (deben coincidir exactamente con feature_names_in_)
const payloadFields = [
  "Edad",
  "PromedioColegio",
  "Asistencia",
  "AniosDesdeIngreso",
  "Materia",
  "PromedioNotaGeneral",
  "TasaAprobacionGeneral",
  "IndiceBloqueo",
  "Genero",
  "AyudaFinanciera",
  "ColegioTecnico",
];

const sectionClassName = "rounded-xl border border-slate-200 bg-slate-50/70 p-5";
const readOnlyClassName = "bg-slate-100 text-slate-600";

function isEmptyValue(value) {
  return value === "" || value === null || value === undefined;
}

function buildPayload(formValues) {
  return Object.fromEntries(
    payloadFields.map((key) => [key, Number(formValues[key])]),
  );
}

export default function MateriaForm({
  onResult,
  isLoading = false,
  initialData = {},
  onPredictStart,
  onPredictEnd,
  onPredictError,
}) {
  const resetValues = { ...initialValues, ...initialData };
  const [formValues, setFormValues] = useState(resetValues);
  const [errors, setErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [materias, setMaterias] = useState([]);

  const submitDisabled = isLoading || isSubmitting;

  useEffect(() => {
    api
      .get("/api/gestion/materias")
      .then((res) => setMaterias(res.data || []))
      .catch(() => setMaterias([]));
  }, []);

  const updateDerivedFields = (nextValues) => {
    const anioCursada = Number(nextValues.AnioCursada || currentYear);
    const anioIngreso = Number(nextValues.AnioIngreso || currentYear - 1);
    const aniosDesdeIngreso = Math.max(0, Math.min(10, anioCursada - anioIngreso));

    // Actualizar IndiceBloqueo según materia seleccionada y plan
    const materiaSeleccionada = materias.find(
      (m) => String(m.codigo_plan) === String(nextValues.Materia),
    );
    const indiceBloqueo = nextValues.IndiceBloqueo ?? "0";

    return {
      ...nextValues,
      AniosDesdeIngreso: String(aniosDesdeIngreso),
      IndiceBloqueo: materiaSeleccionada?.correlativas?.length === 0
        ? "0"
        : indiceBloqueo,
    };
  };

  const fields = useMemo(
    () => ({
      cursada: [
        {
          name: "Materia",
          label: "Materia",
          type: "select",
          options: materias.map((m) => ({
            label: `${m.codigo_plan} - ${m.nombre}`,
            value: String(m.codigo_plan),
          })),
        },
        {
          name: "AnioCursada",
          label: "Año de cursada",
          type: "number",
          min: 2000,
          max: currentYear,
        },
        {
          name: "Asistencia",
          label: "Asistencia (0 a 1)",
          type: "number",
          min: 0,
          max: 1,
          step: "0.01",
        },
      ],
      alumno: [
        {
          name: "Genero",
          label: "Género",
          type: "select",
          options: [
            { label: "Femenino", value: "0" },
            { label: "Masculino", value: "1" },
          ],
        },
        { name: "Edad", label: "Edad", type: "number", min: 17, max: 60 },
        {
          name: "AyudaFinanciera",
          label: "Ayuda financiera",
          type: "select",
          options: [
            { label: "No", value: "0" },
            { label: "Sí", value: "1" },
          ],
        },
        {
          name: "ColegioTecnico",
          label: "Colegio técnico",
          type: "select",
          options: [
            { label: "No", value: "0" },
            { label: "Sí", value: "1" },
          ],
        },
        {
          name: "PromedioColegio",
          label: "Promedio en colegio",
          type: "number",
          min: 0,
          max: 10,
          step: "0.1",
        },
        {
          name: "AnioIngreso",
          label: "Año de ingreso",
          type: "number",
          min: 2000,
          max: currentYear,
        },
        {
          name: "AniosDesdeIngreso",
          label: "Años desde el ingreso",
          type: "number",
          min: 0,
          max: 10,
          readOnly: true,
        },
      ],
      rendimientoGeneral: [
        {
          name: "PromedioNotaGeneral",
          label: "Promedio de nota general",
          type: "number",
          min: 0,
          max: 10,
          step: "0.1",
        },
        {
          name: "TasaAprobacionGeneral",
          label: "Tasa de aprobación general",
          type: "number",
          min: 0,
          max: 1,
          step: "0.01",
        },
        {
          name: "IndiceBloqueo",
          label: "Índice de bloqueo (0=sin bloqueo, 1=bloqueado)",
          type: "number",
          min: 0,
          max: 1,
          step: "0.01",
        },
      ],
    }),
    [materias],
  );

  const validateForm = (values) => {
    const validationErrors = Object.fromEntries(
      Object.entries(values)
        .filter(([key, value]) => payloadFields.includes(key) && isEmptyValue(value))
        .map(([key]) => [key, "Este campo es obligatorio"]),
    );
    return validationErrors;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => updateDerivedFields({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const nextErrors = { ...prev };
      delete nextErrors[name];
      return nextErrors;
    });
  };

  const handleReset = () => {
    setFormValues(resetValues);
    setErrors({});
    setErrorMessage("");
    onResult?.(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    onResult?.(null);
    onPredictError?.("");

    const validationErrors = validateForm(formValues);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    onPredictStart?.();
    setIsSubmitting(true);

    try {
      const payload = buildPayload(formValues);
      const response = await api.post("/api/predict/materia", [payload]);
      onResult?.(response.data?.[0]);
    } catch (error) {
      const message = !error?.response
        ? "No se pudo conectar con el backend. Verificá que esté corriendo en http://localhost:3001"
        : error?.message || error?.response?.data?.error || "No se pudo obtener la predicción.";
      if (onPredictError) onPredictError(message);
      else setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
      onPredictEnd?.();
    }
  };

  const renderField = (field) => {
    const sharedClassName = `mt-2 w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
      errors[field.name] ? "border-red-500" : "border-slate-300"
    } ${field.readOnly ? readOnlyClassName : "bg-white"}`;

    if (field.type === "select") {
      return (
        <select
          id={field.name}
          name={field.name}
          value={formValues[field.name]}
          onChange={handleChange}
          className={sharedClassName}
          required
        >
          {field.name === "Materia" && (
            <option value="">-- Seleccionar materia --</option>
          )}
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        id={field.name}
        name={field.name}
        type="number"
        value={formValues[field.name]}
        onChange={handleChange}
        min={field.min}
        max={field.max}
        step={field.step}
        readOnly={field.readOnly}
        className={sharedClassName}
        required
      />
    );
  };

  const renderSection = (title, description, sectionFields) => (
    <section className={sectionClassName}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sectionFields.map((field) => (
          <div key={field.name}>
            <label htmlFor={field.name} className="text-sm font-medium text-slate-700">
              {field.label}
            </label>
            {renderField(field)}
            {errors[field.name] && (
              <p className="mt-1 text-xs text-red-600">{errors[field.name]}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Predicción de recursado</h2>
        <p className="mt-1 text-sm text-slate-600">
          Completá la información de cursada para estimar riesgo de recursado en la materia.
        </p>
      </div>

      {renderSection(
        "Datos de la cursada",
        "Información de la materia y período actual.",
        fields.cursada,
      )}
      {renderSection(
        "Datos del alumno",
        "Características académicas y demográficas del alumno.",
        fields.alumno,
      )}
      {renderSection(
        "Rendimiento general",
        "Indicadores globales de rendimiento académico y correlativas.",
        fields.rendimientoGeneral,
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={handleReset}
          className="w-full rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-300 sm:w-auto"
        >
          Limpiar
        </button>
        <button
          type="submit"
          disabled={submitDisabled}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 sm:w-auto"
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
