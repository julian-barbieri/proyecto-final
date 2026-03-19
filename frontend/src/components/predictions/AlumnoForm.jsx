import { useMemo, useState } from "react";
import api from "../../api/axios";

const currentYear = new Date().getFullYear();

const initialValues = {
  Genero: "0",
  Edad: "20",
  AyudaFinanciera: "0",
  ColegioTecnico: "0",
  AnioIngreso: String(currentYear),
  PromedioColegio: "7",
  CantMaterias: "0",
  CantRecursa: "0",
  TasaRecursa: "0",
  PromedioAsistencia: "0.75",
  CantAniosCursados: "1",
  CantExamenesRendidos: "0",
  PromedioNota: "5",
  CantFinalesRendidos: "0",
  CantAusencias: "0",
  TasaAusencia: "0",
  CantAprobados: "0",
  TasaAprobacion: "0",
};

const sectionClassName =
  "rounded-xl border border-slate-200 bg-slate-50/70 p-5";
const readOnlyClassName = "bg-slate-100 text-slate-600";

function formatRatio(value) {
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : "0";
}

function isEmptyValue(value) {
  return value === "" || value === null || value === undefined;
}

function buildPayload(formValues) {
  return Object.fromEntries(
    Object.entries(formValues).map(([key, value]) => [key, Number(value)]),
  );
}

export default function AlumnoForm({
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

  const submitDisabled = isLoading || isSubmitting;

  const updateDerivedFields = (nextValues) => {
    const cantMaterias = Number(nextValues.CantMaterias || 0);
    const cantRecursa = Number(nextValues.CantRecursa || 0);
    const cantExamenesRendidos = Number(nextValues.CantExamenesRendidos || 0);
    const cantAusencias = Number(nextValues.CantAusencias || 0);
    const cantAprobados = Number(nextValues.CantAprobados || 0);

    const tasaRecursa = cantMaterias > 0 ? cantRecursa / cantMaterias : 0;
    const tasaAusencia =
      cantExamenesRendidos + cantAusencias > 0
        ? cantAusencias / (cantExamenesRendidos + cantAusencias)
        : 0;
    const tasaAprobacion =
      cantExamenesRendidos > 0 ? cantAprobados / cantExamenesRendidos : 0;

    return {
      ...nextValues,
      TasaRecursa: formatRatio(tasaRecursa),
      TasaAusencia: formatRatio(tasaAusencia),
      TasaAprobacion: formatRatio(tasaAprobacion),
    };
  };

  const fields = useMemo(
    () => ({
      demograficos: [
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
          name: "AnioIngreso",
          label: "Año de ingreso",
          type: "number",
          min: 2000,
          max: currentYear,
        },
        {
          name: "PromedioColegio",
          label: "Promedio en colegio",
          type: "number",
          min: 0,
          max: 10,
          step: "0.1",
        },
      ],
      cursadas: [
        {
          name: "CantMaterias",
          label: "Cantidad de materias cursadas",
          type: "number",
          min: 0,
        },
        {
          name: "CantRecursa",
          label: "Cantidad de recursadas",
          type: "number",
          min: 0,
        },
        {
          name: "TasaRecursa",
          label: "Tasa de recursado (0 a 1)",
          type: "number",
          min: 0,
          max: 1,
          step: "0.01",
          readOnly: true,
        },
        {
          name: "PromedioAsistencia",
          label: "Promedio de asistencia",
          type: "number",
          min: 0,
          max: 1,
          step: "0.01",
        },
        {
          name: "CantAniosCursados",
          label: "Cantidad de años cursados",
          type: "number",
          min: 0,
        },
      ],
      examenes: [
        {
          name: "CantExamenesRendidos",
          label: "Cantidad de exámenes rendidos",
          type: "number",
          min: 0,
        },
        {
          name: "PromedioNota",
          label: "Promedio de nota",
          type: "number",
          min: 0,
          max: 10,
          step: "0.1",
        },
        {
          name: "CantFinalesRendidos",
          label: "Cantidad de finales rendidos",
          type: "number",
          min: 0,
        },
        {
          name: "CantAusencias",
          label: "Cantidad de ausencias",
          type: "number",
          min: 0,
        },
        {
          name: "TasaAusencia",
          label: "Tasa de ausencias (0 a 1)",
          type: "number",
          min: 0,
          max: 1,
          step: "0.01",
          readOnly: true,
        },
        {
          name: "CantAprobados",
          label: "Cantidad de aprobados",
          type: "number",
          min: 0,
        },
        {
          name: "TasaAprobacion",
          label: "Tasa de aprobación (0 a 1)",
          type: "number",
          min: 0,
          max: 1,
          step: "0.01",
          readOnly: true,
        },
      ],
    }),
    [],
  );

  const validateForm = (values) => {
    return Object.fromEntries(
      Object.entries(values)
        .filter(([, value]) => isEmptyValue(value))
        .map(([key]) => [key, "Este campo es obligatorio"]),
    );
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormValues((prev) => {
      const nextValues = updateDerivedFields({ ...prev, [name]: value });
      return nextValues;
    });

    setErrors((prev) => {
      if (!prev[name]) {
        return prev;
      }

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

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    onPredictStart?.();
    setIsSubmitting(true);

    try {
      const payload = buildPayload(formValues);
      const response = await api.post("/api/predict/alumno", [payload]);
      onResult?.(response.data?.[0]);
    } catch (error) {
      const message = !error?.response
        ? "No se pudo conectar con el backend. Verificá que esté corriendo en http://localhost:3001"
        : error?.message ||
          error?.response?.data?.error ||
          "No se pudo obtener la predicción.";

      if (onPredictError) {
        onPredictError(message);
      } else {
        setErrorMessage(message);
      }
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
            <label
              htmlFor={field.name}
              className="text-sm font-medium text-slate-700"
            >
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
        <h2 className="text-xl font-semibold text-slate-900">
          Predicción de abandono
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Completá los datos del alumno para estimar el riesgo de abandono
          académico.
        </p>
      </div>

      {renderSection(
        "Datos demográficos",
        "Información general del alumno.",
        fields.demograficos,
      )}
      {renderSection(
        "Historial de cursadas",
        "Indicadores de avance y recursado.",
        fields.cursadas,
      )}
      {renderSection(
        "Historial de exámenes",
        "Resultados y ausencias acumuladas.",
        fields.examenes,
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
          Limpiar formulario
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
