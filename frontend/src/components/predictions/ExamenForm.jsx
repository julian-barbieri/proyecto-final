import { useMemo, useState } from "react";
import api from "../../api/axios";

const currentYear = new Date().getFullYear();

const initialValues = {
  Materia: "0",
  TipoExamen: "Parcial",
  Instancia: "1",
  Anio: String(currentYear),
  Asistencia: "0.75",
  VecesRecursada: "0",
  PosicionFlujo: "1",
  AsistenciaBajaRiesgo: "0",
  EsUltimaInstancia: "0",
  Genero: "0",
  Edad: "20",
  AyudaFinanciera: "0",
  ColegioTecnico: "0",
  PromedioColegio: "7",
  AnioIngreso: String(currentYear - 1),
  AniosDesdeIngreso: "1",
  VecesCursadaMateria: "1",
  TasaRecursaMateria: "0",
  PromedioAsistenciaHistMateria: "0.75",
  TotalCursadasGeneral: "1",
  TasaRecursaGeneral: "0",
  PromedioAsistenciaGeneral: "0.75",
  NotaPromedioParcialCursada: "5",
  CantParcialesAprobados: "0",
  TieneFinalAM1: "0",
};

const payloadFields = [
  "Materia",
  "TipoExamen",
  "Instancia",
  "Anio",
  "Asistencia",
  "VecesRecursada",
  "Genero",
  "Edad",
  "AyudaFinanciera",
  "ColegioTecnico",
  "PromedioColegio",
  "AniosDesdeIngreso",
  "VecesCursadaMateria",
  "TasaRecursaMateria",
  "PromedioAsistenciaHistMateria",
  "TotalCursadasGeneral",
  "TasaRecursaGeneral",
  "PromedioAsistenciaGeneral",
  "PosicionFlujo",
  "AsistenciaBajaRiesgo",
  "NotaPromedioParcialCursada",
  "CantParcialesAprobados",
  "EsUltimaInstancia",
  "TieneFinalAM1",
];

const sectionClassName =
  "rounded-xl border border-slate-200 bg-slate-50/70 p-5";
const readOnlyClassName = "bg-slate-100 text-slate-600";

const posicionFlujoMap = {
  Parcial: { 1: 1, 2: 2 },
  Recuperatorio: { 1: 3, 2: 4 },
  Final: { 1: 5, 2: 6, 3: 7 },
};

function isEmptyValue(value) {
  return value === "" || value === null || value === undefined;
}

function getInstanciaOptions(tipoExamen) {
  if (tipoExamen === "Final") {
    return ["1", "2", "3"];
  }

  return ["1", "2"];
}

function getMaxCantParcialesAprobados(tipoExamen, instancia) {
  const instanciaNumerica = Number(instancia || 1);

  if (tipoExamen === "Parcial") {
    return Math.min(2, Math.max(1, instanciaNumerica));
  }

  return 2;
}

function buildPayload(formValues) {
  return Object.fromEntries(
    payloadFields.map((key) => {
      if (key === "TipoExamen") {
        return [key, formValues[key]];
      }

      if (key === "TieneFinalAM1" && formValues.Materia !== "1") {
        return [key, 0];
      }

      return [key, Number(formValues[key])];
    }),
  );
}

export default function ExamenForm({
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
  const instanciaOptions = getInstanciaOptions(formValues.TipoExamen);
  const maxCantParcialesAprobados = getMaxCantParcialesAprobados(
    formValues.TipoExamen,
    formValues.Instancia,
  );

  const updateDerivedFields = (nextValues) => {
    const anio = Number(nextValues.Anio || currentYear);
    const anioIngreso = Number(nextValues.AnioIngreso || currentYear - 1);
    const asistencia = Number(nextValues.Asistencia || 0);
    const instancia = Number(nextValues.Instancia || 1);
    const tieneFinalAM1 =
      nextValues.Materia === "1" ? nextValues.TieneFinalAM1 : "0";

    const aniosDesdeIngreso = Math.max(0, anio - anioIngreso);
    const posicionFlujo =
      posicionFlujoMap[nextValues.TipoExamen]?.[instancia] ?? 1;
    const asistenciaBajaRiesgo = asistencia < 0.75 ? 1 : 0;
    const esUltimaInstancia =
      nextValues.TipoExamen === "Final" && instancia === 3 ? 1 : 0;

    return {
      ...nextValues,
      AniosDesdeIngreso: String(aniosDesdeIngreso),
      PosicionFlujo: String(posicionFlujo),
      AsistenciaBajaRiesgo: String(asistenciaBajaRiesgo),
      EsUltimaInstancia: String(esUltimaInstancia),
      TieneFinalAM1: tieneFinalAM1,
    };
  };

  const fields = useMemo(
    () => ({
      examen: [
        {
          name: "Materia",
          label: "Materia",
          type: "select",
          options: [
            { label: "AM1 - Análisis Matemático 1", value: "0" },
            { label: "AM2 - Análisis Matemático 2", value: "1" },
          ],
        },
        {
          name: "TipoExamen",
          label: "Tipo de examen",
          type: "select",
          options: [
            { label: "Parcial", value: "Parcial" },
            { label: "Recuperatorio", value: "Recuperatorio" },
            { label: "Final", value: "Final" },
          ],
        },
        {
          name: "Instancia",
          label: "Instancia",
          type: "select",
          options: [],
        },
        {
          name: "Anio",
          label: "Año",
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
        {
          name: "VecesRecursada",
          label: "Veces que recursó esta materia",
          type: "number",
          min: 0,
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
          readOnly: true,
        },
      ],
      historialMateria: [
        {
          name: "VecesCursadaMateria",
          label: "Veces cursada esta materia",
          type: "number",
          min: 1,
        },
        {
          name: "TasaRecursaMateria",
          label: "Tasa de recursado en esta materia",
          type: "number",
          min: 0,
          max: 1,
          step: "0.01",
        },
        {
          name: "PromedioAsistenciaHistMateria",
          label: "Promedio de asistencia histórica en materia",
          type: "number",
          min: 0,
          max: 1,
          step: "0.01",
        },
      ],
      historialGeneral: [
        {
          name: "TotalCursadasGeneral",
          label: "Total de cursadas general",
          type: "number",
          min: 0,
        },
        {
          name: "TasaRecursaGeneral",
          label: "Tasa de recursado general",
          type: "number",
          min: 0,
          max: 1,
          step: "0.01",
        },
        {
          name: "PromedioAsistenciaGeneral",
          label: "Promedio de asistencia general",
          type: "number",
          min: 0,
          max: 1,
          step: "0.01",
        },
      ],
      rendimiento: [
        {
          name: "NotaPromedioParcialCursada",
          label: "Promedio de notas en parciales de esta cursada",
          type: "number",
          min: 0,
          max: 10,
          step: "0.1",
        },
        {
          name: "CantParcialesAprobados",
          label: "Cantidad de parciales aprobados",
          type: "number",
          min: 0,
          max: 2,
        },
        {
          name: "TieneFinalAM1",
          label: "¿Tiene Final de AM1 aprobado?",
          type: "select",
          options: [
            { label: "No", value: "0" },
            { label: "Sí", value: "1" },
          ],
        },
      ],
    }),
    [],
  );

  const validateForm = (values) => {
    const validationErrors = Object.fromEntries(
      Object.entries(values)
        .filter(([key, value]) => {
          if (
            [
              "PosicionFlujo",
              "AsistenciaBajaRiesgo",
              "EsUltimaInstancia",
            ].includes(key)
          ) {
            return false;
          }

          return isEmptyValue(value);
        })
        .map(([key]) => [key, "Este campo es obligatorio"]),
    );

    const cantParcialesAprobados = Number(values.CantParcialesAprobados || 0);
    const maxParcialesAprobados = getMaxCantParcialesAprobados(
      values.TipoExamen,
      values.Instancia,
    );

    if (cantParcialesAprobados > 2) {
      validationErrors.CantParcialesAprobados =
        "La cantidad de parciales aprobados no puede superar 2.";
    } else if (cantParcialesAprobados > maxParcialesAprobados) {
      validationErrors.CantParcialesAprobados =
        values.TipoExamen === "Parcial"
          ? `Para ${values.TipoExamen.toLowerCase()} ${values.Instancia}, la cantidad de parciales aprobados no puede superar ${maxParcialesAprobados}.`
          : `La cantidad de parciales aprobados no puede superar ${maxParcialesAprobados}.`;
    }

    const notaPromedioParcialCursada = Number(
      values.NotaPromedioParcialCursada || 0,
    );

    if (cantParcialesAprobados === 0 && notaPromedioParcialCursada >= 4) {
      validationErrors.NotaPromedioParcialCursada =
        "Si no hay parciales aprobados, el promedio de parciales no debería ser aprobatorio.";
    }

    if (cantParcialesAprobados > 0 && notaPromedioParcialCursada === 0) {
      validationErrors.NotaPromedioParcialCursada =
        "Si hay parciales aprobados, el promedio de parciales no puede ser 0.";
    }

    if (values.Materia !== "1" && values.TieneFinalAM1 !== "0") {
      validationErrors.TieneFinalAM1 =
        "Solo se puede informar Final de AM1 aprobado cuando la materia es AM2.";
    }

    return validationErrors;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormValues((prev) => {
      const nextValues = {
        ...prev,
        [name]: value,
      };

      if (name === "TipoExamen") {
        nextValues.Instancia = "1";
      }

      return updateDerivedFields(nextValues);
    });

    setErrors((prev) => {
      if (
        !prev[name] &&
        !(
          prev.CantParcialesAprobados &&
          ["TipoExamen", "Instancia", "CantParcialesAprobados"].includes(name)
        ) &&
        !(
          prev.NotaPromedioParcialCursada &&
          ["CantParcialesAprobados", "NotaPromedioParcialCursada"].includes(
            name,
          )
        ) &&
        !(prev.TieneFinalAM1 && ["Materia", "TieneFinalAM1"].includes(name))
      ) {
        return prev;
      }

      const nextErrors = { ...prev };
      delete nextErrors[name];

      if (
        ["TipoExamen", "Instancia", "CantParcialesAprobados"].includes(name)
      ) {
        delete nextErrors.CantParcialesAprobados;
      }

      if (
        ["CantParcialesAprobados", "NotaPromedioParcialCursada"].includes(name)
      ) {
        delete nextErrors.NotaPromedioParcialCursada;
      }

      if (["Materia", "TieneFinalAM1"].includes(name)) {
        delete nextErrors.TieneFinalAM1;
      }

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
      const response = await api.post("/api/predict/examen", [payload]);
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
      const options =
        field.name === "Instancia"
          ? instanciaOptions.map((value) => ({ label: value, value }))
          : field.options;

      return (
        <select
          id={field.name}
          name={field.name}
          value={formValues[field.name]}
          onChange={handleChange}
          className={sharedClassName}
          required
        >
          {options.map((option) => (
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
        max={
          field.name === "CantParcialesAprobados"
            ? maxCantParcialesAprobados
            : field.max
        }
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
          Predicción de nota de examen
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Cargá los datos del examen y del alumno para estimar la nota esperada.
        </p>
      </div>

      {renderSection(
        "Datos del examen",
        "Información principal del examen a rendir.",
        fields.examen,
      )}
      {renderSection(
        "Datos del alumno",
        "Datos demográficos y académicos base del alumno.",
        fields.alumno,
      )}
      {renderSection(
        "Historial en esta materia",
        "Indicadores históricos específicos de la materia.",
        fields.historialMateria,
      )}
      {renderSection(
        "Historial general",
        "Indicadores históricos del desempeño general.",
        fields.historialGeneral,
      )}
      {renderSection(
        "Rendimiento en la cursada actual",
        "Desempeño de la cursada vigente.",
        fields.rendimiento.filter(
          (field) =>
            field.name !== "TieneFinalAM1" || formValues.Materia === "1",
        ),
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
