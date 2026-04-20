import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

const currentYear = new Date().getFullYear();

const initialValues = {
  Materia: "",
  Cuatrimestre: "0",
  Anio: String(currentYear),
  Instancia: "1",
  Genero: "0",
  AyudaFinanciera: "0",
  ColegioTecnico: "0",
  PromedioColegio: "7",
  Asistencia: "0.75",
  VecesRecursada: "0",
  AnoCarrera: "1",
  NotaPromedioCorrelativas: "0",
  MateriasAprobadasHastaMomento: "0",
  CargaSimultanea: "1",
  IndiceBloqueo: "0",
  AnioIngreso: String(currentYear - 1),
  AniosDesdeIngreso: "1",
  VecesCursadaMateria: "1",
  TasaRecursaMateria: "0",
  PromedioAsistenciaHistMateria: "0.75",
  TotalCursadasGeneral: "1",
  TasaRecursaGeneral: "0",
  PromedioAsistenciaGeneral: "0.75",
  PosicionFlujo: "1",
  NotaPromedioParcialCursada: "5",
  CantParcialesAprobados: "0",
  Edad: "20",
  TipoExamen: "Parcial",
  Tipo: "C",
};

// payloadFields exactamente en el orden/nombres de feature_names_in_ del modelo examen
// TipoExamen y Tipo se envían como strings; el AI service los OHE internamente
const payloadFields = [
  "Materia",
  "Cuatrimestre",
  "Anio",
  "Instancia",
  "Genero",
  "AyudaFinanciera",
  "ColegioTecnico",
  "PromedioColegio",
  "Asistencia",
  "VecesRecursada",
  "AñoCarrera",
  "NotaPromedioCorrelativas",
  "MateriasAprobadasHastaMomento",
  "CargaSimultanea",
  "IndiceBloqueo",
  "AniosDesdeIngreso",
  "VecesCursadaMateria",
  "TasaRecursaMateria",
  "PromedioAsistenciaHistMateria",
  "TotalCursadasGeneral",
  "TasaRecursaGeneral",
  "PromedioAsistenciaGeneral",
  "PosicionFlujo",
  "NotaPromedioParcialCursada",
  "CantParcialesAprobados",
  "Edad",
  "TipoExamen",
  "Tipo",
];

const sectionClassName = "rounded-xl border border-slate-200 bg-slate-50/70 p-5";
const readOnlyClassName = "bg-slate-100 text-slate-600";

const posicionFlujoMap = {
  Parcial: { 1: 1, 2: 3 },
  Recuperatorio: { 1: 2, 2: 4 },
  Final: { 1: 5, 2: 6, 3: 7 },
};

function isEmptyValue(value) {
  return value === "" || value === null || value === undefined;
}

function getInstanciaOptions(tipoExamen) {
  if (tipoExamen === "Final") return ["1", "2", "3"];
  return ["1", "2"];
}

function getMaxCantParcialesAprobados(tipoExamen, instancia) {
  const n = Number(instancia || 1);
  if (tipoExamen === "Parcial") return Math.min(2, Math.max(1, n));
  return 2;
}

function buildPayload(formValues) {
  return Object.fromEntries(
    payloadFields.map((key) => {
      // Los campos OHE se envían como string
      if (key === "TipoExamen") return [key, formValues.TipoExamen];
      if (key === "Tipo") return [key, formValues.Tipo];
      // AñoCarrera tiene tilde — viene de formValues.AnoCarrera (sin tilde en el form)
      if (key === "AñoCarrera") return [key, Number(formValues.AnoCarrera || 1)];
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
  const [materias, setMaterias] = useState([]);

  const submitDisabled = isLoading || isSubmitting;
  const instanciaOptions = getInstanciaOptions(formValues.TipoExamen);
  const maxCantParcialesAprobados = getMaxCantParcialesAprobados(
    formValues.TipoExamen,
    formValues.Instancia,
  );

  useEffect(() => {
    api
      .get("/api/gestion/materias")
      .then((res) => setMaterias(res.data || []))
      .catch(() => setMaterias([]));
  }, []);

  const updateDerivedFields = (nextValues) => {
    const anio = Number(nextValues.Anio || currentYear);
    const anioIngreso = Number(nextValues.AnioIngreso || currentYear - 1);
    const instancia = Number(nextValues.Instancia || 1);

    const aniosDesdeIngreso = Math.max(0, anio - anioIngreso);
    const posicionFlujo = posicionFlujoMap[nextValues.TipoExamen]?.[instancia] ?? 1;

    // Auto-derivar Tipo y AñoCarrera desde la materia seleccionada
    const materiaSeleccionada = materias.find(
      (m) => String(m.codigo_plan) === String(nextValues.Materia),
    );
    const tipo = materiaSeleccionada?.tipo ?? nextValues.Tipo ?? "C";
    const anoCarrera = materiaSeleccionada?.anio_carrera ?? nextValues.AnoCarrera ?? 1;
    // Materias anuales (tipo 'A') tienen cuatrimestre = 0
    const cuatrimestre =
      tipo === "A" ? "0" : nextValues.Cuatrimestre ?? "1";

    return {
      ...nextValues,
      AniosDesdeIngreso: String(aniosDesdeIngreso),
      PosicionFlujo: String(posicionFlujo),
      Tipo: tipo,
      AnoCarrera: String(anoCarrera),
      Cuatrimestre: cuatrimestre,
    };
  };

  const fields = useMemo(
    () => ({
      examen: [
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
          name: "Cuatrimestre",
          label: "Cuatrimestre (0=anual, 1=1°C, 2=2°C)",
          type: "select",
          options: [
            { label: "Anual (0)", value: "0" },
            { label: "1° Cuatrimestre", value: "1" },
            { label: "2° Cuatrimestre", value: "2" },
          ],
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
        {
          name: "AnoCarrera",
          label: "Año de carrera (derivado de la materia)",
          type: "number",
          min: 1,
          max: 5,
          readOnly: true,
        },
      ],
      contexto: [
        {
          name: "MateriasAprobadasHastaMomento",
          label: "Materias aprobadas hasta el momento",
          type: "number",
          min: 0,
        },
        {
          name: "CargaSimultanea",
          label: "Materias cursadas simultáneamente",
          type: "number",
          min: 1,
        },
        {
          name: "IndiceBloqueo",
          label: "Índice de bloqueo (0=sin bloqueo, 1=bloqueado)",
          type: "number",
          min: 0,
          max: 1,
          step: "0.01",
        },
        {
          name: "NotaPromedioCorrelativas",
          label: "Promedio de notas en correlativas",
          type: "number",
          min: 0,
          max: 10,
          step: "0.1",
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
          name: "PosicionFlujo",
          label: "Posición en el flujo académico (1-7)",
          type: "number",
          min: 1,
          max: 7,
          readOnly: true,
        },
      ],
    }),
    [materias],
  );

  const validateForm = (values) => {
    const skipKeys = new Set(["PosicionFlujo", "AnoCarrera", "Tipo"]);
    const numericPayloadKeys = payloadFields.filter(
      (k) => k !== "TipoExamen" && k !== "Tipo" && k !== "AñoCarrera",
    );
    const validationErrors = Object.fromEntries(
      numericPayloadKeys
        .filter((key) => {
          const formKey = key === "AñoCarrera" ? "AnoCarrera" : key;
          return !skipKeys.has(formKey) && isEmptyValue(values[formKey]);
        })
        .map((key) => {
          const formKey = key === "AñoCarrera" ? "AnoCarrera" : key;
          return [formKey, "Este campo es obligatorio"];
        }),
    );

    const cant = Number(values.CantParcialesAprobados || 0);
    if (cant > 2) {
      validationErrors.CantParcialesAprobados =
        "La cantidad de parciales aprobados no puede superar 2.";
    } else if (cant > maxCantParcialesAprobados) {
      validationErrors.CantParcialesAprobados = `Para ${values.TipoExamen.toLowerCase()} ${values.Instancia}, no puede superar ${maxCantParcialesAprobados}.`;
    }

    const notaPromedio = Number(values.NotaPromedioParcialCursada || 0);
    if (cant === 0 && notaPromedio >= 4) {
      validationErrors.NotaPromedioParcialCursada =
        "Si no hay parciales aprobados, el promedio no debería ser aprobatorio.";
    }
    if (cant > 0 && notaPromedio === 0) {
      validationErrors.NotaPromedioParcialCursada =
        "Si hay parciales aprobados, el promedio no puede ser 0.";
    }

    return validationErrors;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => {
      const nextValues = { ...prev, [name]: value };
      if (name === "TipoExamen") nextValues.Instancia = "1";
      return updateDerivedFields(nextValues);
    });
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
      const response = await api.post("/api/predict/examen", [payload]);
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
      const options =
        field.name === "Instancia"
          ? instanciaOptions.map((v) => ({ label: v, value: v }))
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
          {field.name === "Materia" && (
            <option value="">-- Seleccionar materia --</option>
          )}
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
        <h2 className="text-xl font-semibold text-slate-900">Predicción de nota de examen</h2>
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
        "Contexto académico",
        "Información sobre correlativas, carga simultánea y bloqueo.",
        fields.contexto,
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
        fields.rendimiento,
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
