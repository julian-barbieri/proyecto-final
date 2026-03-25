import { useMemo, useState } from "react";
import api from "../../api/axios";
import ErrorMessage from "../ErrorMessage";

const TIPOS = ["Parcial", "Recuperatorio", "Final"];

export default function CargarNotaModal({
  materiaId,
  anio,
  alumnos = [],
  initialPayload,
  onClose,
  onGuardada,
}) {
  const [form, setForm] = useState(() => ({
    alumno_id: initialPayload?.alumno_id || alumnos[0]?.legajo || "",
    tipo: initialPayload?.tipo || "Parcial",
    instancia: initialPayload?.instancia || 1,
    nota: initialPayload?.nota ?? "",
    rendido: initialPayload?.rendido ?? 1,
    ausente: initialPayload?.ausente ?? 0,
    asistencia: initialPayload?.asistencia ?? "",
    veces_recursada: initialPayload?.veces_recursada ?? 0,
    fecha_examen: initialPayload?.fecha_examen || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const instanciaOptions = useMemo(() => {
    if (form.tipo === "Final") {
      return [1, 2, 3];
    }
    return [1, 2];
  }, [form.tipo]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const notaNumber =
      form.nota === "" || form.nota === null || form.nota === undefined
        ? null
        : Number(form.nota);

    if (!form.alumno_id) {
      setError("Seleccioná un alumno.");
      return;
    }

    if (notaNumber !== null && (notaNumber < 1 || notaNumber > 10)) {
      setError("La nota debe estar entre 1 y 10.");
      return;
    }

    const asistenciaValue =
      form.asistencia === "" || form.asistencia === null
        ? null
        : Number(form.asistencia);

    if (
      asistenciaValue !== null &&
      (Number.isNaN(asistenciaValue) ||
        asistenciaValue < 0 ||
        asistenciaValue > 1)
    ) {
      setError("La asistencia debe estar entre 0 y 1.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        alumno_id: Number(form.alumno_id),
        materia_id: Number(materiaId),
        anio: Number(anio),
        tipo: form.tipo,
        instancia: Number(form.instancia),
        nota: notaNumber,
        rendido: Number(form.rendido),
        ausente: Number(form.ausente),
        veces_recursada: Number(form.veces_recursada || 0),
        asistencia: asistenciaValue,
        fecha_examen: form.fecha_examen || null,
      };

      const response = await api.post("/api/notas/examenes", payload);
      onGuardada(response.data);
      onClose();
    } catch (submitError) {
      setError(submitError.message || "No se pudo guardar la nota.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Cargar nota
            </h3>
            <p className="text-sm text-slate-600">
              Materia #{materiaId} · Año {anio}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </header>

        {error ? (
          <div className="mb-3">
            <ErrorMessage message={error} onDismiss={() => setError("")} />
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-slate-700 md:col-span-2">
            Alumno
            <select
              value={form.alumno_id}
              onChange={(event) =>
                handleChange("alumno_id", event.target.value)
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {alumnos.map((alumno) => (
                <option key={alumno.legajo} value={alumno.legajo}>
                  {alumno.nombre_completo} (Legajo {alumno.legajo})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Tipo de examen
            <select
              value={form.tipo}
              onChange={(event) => {
                const tipo = event.target.value;
                const nextInstancia =
                  tipo === "Final"
                    ? form.instancia
                    : Math.min(Number(form.instancia), 2);
                handleChange("tipo", tipo);
                handleChange("instancia", nextInstancia);
              }}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Instancia
            <select
              value={form.instancia}
              onChange={(event) =>
                handleChange("instancia", Number(event.target.value))
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {instanciaOptions.map((instancia) => (
                <option key={instancia} value={instancia}>
                  {instancia}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Nota
            <input
              type="number"
              min="1"
              max="10"
              step="0.01"
              value={form.nota}
              onChange={(event) => handleChange("nota", event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm text-slate-700">
            Asistencia (0 a 1)
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={form.asistencia}
              onChange={(event) =>
                handleChange("asistencia", event.target.value)
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm text-slate-700">
            Rendido
            <select
              value={form.rendido}
              onChange={(event) =>
                handleChange("rendido", Number(event.target.value))
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value={1}>Sí</option>
              <option value={0}>No</option>
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Ausente
            <select
              value={form.ausente}
              onChange={(event) =>
                handleChange("ausente", Number(event.target.value))
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value={0}>No</option>
              <option value={1}>Sí</option>
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Veces recursada
            <input
              type="number"
              min="0"
              step="1"
              value={form.veces_recursada}
              onChange={(event) =>
                handleChange("veces_recursada", event.target.value)
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm text-slate-700">
            Fecha examen (DD-MM-YYYY)
            <input
              type="text"
              value={form.fecha_examen}
              onChange={(event) =>
                handleChange("fecha_examen", event.target.value)
              }
              placeholder="14-06-2024"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <footer className="mt-2 flex justify-end gap-2 md:col-span-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
