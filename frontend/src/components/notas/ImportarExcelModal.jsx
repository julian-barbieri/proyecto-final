import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "../../api/axios";
import ErrorMessage from "../ErrorMessage";

export default function ImportarExcelModal({ onClose, onImportada }) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  const fileLabel = useMemo(() => {
    if (!file) {
      return "Ningún archivo seleccionado";
    }

    return `${file.name} (${Math.round(file.size / 1024)} KB)`;
  }, [file]);

  const descargarPlantilla = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "Legajo",
        "Materia",
        "Anio",
        "TipoExamen",
        "Instancia",
        "ExamenRendido",
        "AusenteExamen",
        "Nota",
        "VecesRecursada",
        "Asistencia",
        "FechaExamen",
      ],
      [1, "AM1", 2024, "Parcial", 1, 1, 0, 7.5, 0, 0.85, "14-06-2024"],
      [2, "AM2", 2024, "Final", 1, 0, 1, null, 1, 0.7, "20-12-2024"],
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notas");
    XLSX.writeFile(wb, "plantilla_notas.xlsx");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) {
      setError("Seleccioná un archivo .xlsx");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("archivo", file);

      const response = await api.post("/api/notas/importar-excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResultado(response.data);
      onImportada(response.data);
    } catch (submitError) {
      setError(submitError.message || "No se pudo importar el archivo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Importar notas desde Excel
            </h3>
            <p className="text-sm text-slate-600">
              Formato requerido: igual a Test_Examenes.xlsx
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

        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p>
            Columnas: Legajo, Materia, Anio, TipoExamen, Instancia,
            ExamenRendido, AusenteExamen, Nota, VecesRecursada, Asistencia,
            FechaExamen.
          </p>
          <button
            type="button"
            onClick={descargarPlantilla}
            className="mt-2 text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            Descargar plantilla de ejemplo
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-700">
            <span className="font-medium">Seleccionar archivo .xlsx</span>
            <input
              type="file"
              accept=".xlsx"
              className="mt-2 block w-full text-sm"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setResultado(null);
              }}
            />
            <p className="mt-2 text-xs text-slate-500">{fileLabel}</p>
          </label>

          {resultado ? (
            <div className="rounded-md border border-slate-200 p-3 text-sm">
              <p className="text-emerald-700">
                ✅ Filas OK: {resultado.filas_ok || 0}
              </p>
              <p className="text-red-600">
                ❌ Filas con error: {resultado.filas_error || 0}
              </p>
              {(resultado.errores || []).length > 0 ? (
                <ul className="mt-2 max-h-32 list-disc overflow-auto pl-5 text-xs text-red-700">
                  {resultado.errores.map((item, idx) => (
                    <li key={`${item.fila}-${idx}`}>
                      Fila {item.fila}: {item.motivo}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <footer className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Importando..." : "Importar"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
