import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import api from "../api/axios";
import CargarNotaModal from "../components/notas/CargarNotaModal";
import ImportarExcelModal from "../components/notas/ImportarExcelModal";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";

const DEFAULT_COLUMNS = [
  { key: "Parcial-1", label: "P1", tipo: "Parcial", instancia: 1 },
  { key: "Parcial-2", label: "P2", tipo: "Parcial", instancia: 2 },
  { key: "Recuperatorio-1", label: "R1", tipo: "Recuperatorio", instancia: 1 },
  { key: "Recuperatorio-2", label: "R2", tipo: "Recuperatorio", instancia: 2 },
  { key: "Final-1", label: "F1", tipo: "Final", instancia: 1 },
  { key: "Final-2", label: "F2", tipo: "Final", instancia: 2 },
  { key: "Final-3", label: "F3", tipo: "Final", instancia: 3 },
];

function examKey(tipo, instancia) {
  return `${tipo}-${instancia}`;
}

export default function GestionNotas() {
  const [materias, setMaterias] = useState([]);
  const [materiaId, setMateriaId] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [flashMap, setFlashMap] = useState({});
  const [toast, setToast] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualInitialPayload, setManualInitialPayload] = useState(null);
  const [showExcelModal, setShowExcelModal] = useState(false);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }).map((_, index) => current - index);
  }, []);

  const columns = useMemo(() => {
    const set = new Set(DEFAULT_COLUMNS.map((item) => item.key));
    const dynamic = [];

    for (const row of rows) {
      for (const exam of row.examenes || []) {
        const key = examKey(exam.tipo, exam.instancia);
        if (!set.has(key)) {
          set.add(key);
          dynamic.push({
            key,
            label: `${exam.tipo[0]}${exam.instancia}`,
            tipo: exam.tipo,
            instancia: exam.instancia,
          });
        }
      }
    }

    return [...DEFAULT_COLUMNS, ...dynamic];
  }, [rows]);

  const loadMaterias = async () => {
    try {
      const response = await api.get("/api/gestion/mis-materias");
      const activas = response.data?.activas || [];
      setMaterias(activas);

      if (!materiaId && activas[0]) {
        setMateriaId(String(activas[0].materia_id));
      }
    } catch (fetchError) {
      setError(
        fetchError.message || "No se pudieron cargar las materias del docente.",
      );
    }
  };

  const loadNotas = async (nextMateriaId = materiaId, nextAnio = anio) => {
    if (!nextMateriaId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get(
        `/api/notas/alumnos-materia/${nextMateriaId}`,
        {
          params: { anio: nextAnio },
        },
      );
      setRows(response.data || []);
    } catch (fetchError) {
      setError(fetchError.message || "No se pudieron cargar las notas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterias();
  }, []);

  useEffect(() => {
    if (materiaId) {
      loadNotas(materiaId, anio);
    }
  }, [materiaId, anio]);

  const setCellFlash = (cellId, type) => {
    setFlashMap((prev) => ({ ...prev, [cellId]: type }));
    window.setTimeout(() => {
      setFlashMap((prev) => {
        const next = { ...prev };
        delete next[cellId];
        return next;
      });
    }, 1500);
  };

  const upsertNota = async (payload, cellId) => {
    try {
      await api.post("/api/notas/examenes", payload);
      setCellFlash(cellId, "success");
      setToast({ type: "success", message: "Nota guardada correctamente." });
      await loadNotas(payload.materia_id, payload.anio);
    } catch (saveError) {
      setCellFlash(cellId, "error");
      setError(saveError.message || "No se pudo guardar la nota.");
      throw saveError;
    }
  };

  const startInlineEditing = (row, column, exam) => {
    const cellId = `${row.legajo}-${column.key}`;
    setEditingCell({
      cellId,
      legajo: row.legajo,
      column,
      exam,
    });
    setEditingValue(exam?.nota ?? "");
  };

  const saveInlineEditing = async () => {
    if (!editingCell) {
      return;
    }

    const nota = editingValue === "" ? null : Number(editingValue);

    if (nota !== null && (Number.isNaN(nota) || nota < 1 || nota > 10)) {
      setError("La nota debe estar entre 1 y 10.");
      return;
    }

    const payload = {
      alumno_id: editingCell.legajo,
      materia_id: Number(materiaId),
      anio,
      tipo: editingCell.column.tipo,
      instancia: editingCell.column.instancia,
      nota,
      rendido: nota === null ? 0 : 1,
      ausente: nota === null ? 1 : 0,
      asistencia: editingCell.exam?.asistencia ?? null,
      veces_recursada: editingCell.exam?.veces_recursada ?? 0,
      fecha_examen: editingCell.exam?.fecha_examen ?? null,
    };

    try {
      await upsertNota(payload, editingCell.cellId);
      setEditingCell(null);
      setEditingValue("");
    } catch {
      // el error ya se informa en upsertNota
    }
  };

  const openCreateFromCell = (row, column) => {
    setManualInitialPayload({
      alumno_id: row.legajo,
      tipo: column.tipo,
      instancia: column.instancia,
      nota: "",
      rendido: 1,
      ausente: 0,
      asistencia: "",
      veces_recursada: 0,
      fecha_examen: "",
    });
    setShowManualModal(true);
  };

  const getExamByColumn = (row, column) =>
    (row.examenes || []).find(
      (exam) =>
        exam.tipo === column.tipo &&
        Number(exam.instancia) === Number(column.instancia),
    );

  return (
    <div className="space-y-6">
      {/* Header con acento brand: identifica visualmente la herramienta del profesor */}
      <section className="rounded-lg border border-surface-border border-t-[3px] border-t-brand-500 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Gestión de notas
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Cargá o importá notas de exámenes de tus materias asignadas.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setManualInitialPayload(null);
                setShowManualModal(true);
              }}
              className="rounded-md border border-surface-border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-surface-hover transition-colors"
            >
              + Cargar nota
            </button>
            {/* Download SVG reemplaza emoji 📥 */}
            <button
              type="button"
              onClick={() => setShowExcelModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Importar Excel
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <ErrorMessage message={error} onDismiss={() => setError("")} />
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <select
            value={materiaId}
            onChange={(event) => setMateriaId(event.target.value)}
            className="rounded-md border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {materias.map((materia) => (
              <option key={materia.id} value={materia.materia_id}>
                {materia.materia_codigo} - {materia.materia_nombre}
              </option>
            ))}
          </select>

          <select
            value={anio}
            onChange={(event) => setAnio(Number(event.target.value))}
            className="rounded-md border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading ? (
        <LoadingSpinner size="md" text="Cargando notas de la materia..." />
      ) : null}

      {!loading ? (
        <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-brand-50 text-slate-700 border-b border-surface-border">
              <tr>
                <th className="px-3 py-2 text-left">Legajo</th>
                <th className="px-3 py-2 text-left">Alumno</th>
                {columns.map((column) => (
                  <th key={column.key} className="px-3 py-2 text-left">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.legajo} className="border-t border-slate-100">
                  <td className="px-3 py-2">{row.legajo}</td>
                  <td className="px-3 py-2">{row.nombre_completo}</td>
                  {columns.map((column) => {
                    const exam = getExamByColumn(row, column);
                    const cellId = `${row.legajo}-${column.key}`;
                    const flash = flashMap[cellId];
                    const isEditing = editingCell?.cellId === cellId;

                    return (
                      <td key={cellId} className="px-3 py-2">
                        <button
                          type="button"
                          className={`min-w-[56px] rounded-md border px-2 py-1 text-left ${
                            flash === "success"
                              ? "border-emerald-300 bg-emerald-100"
                              : flash === "error"
                                ? "border-red-300 bg-red-100"
                                : "border-slate-200 hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            if (exam) {
                              startInlineEditing(row, column, exam);
                            } else {
                              openCreateFromCell(row, column);
                            }
                          }}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editingValue}
                              onChange={(event) =>
                                setEditingValue(event.target.value)
                              }
                              onBlur={saveInlineEditing}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  saveInlineEditing();
                                }
                                if (event.key === "Escape") {
                                  setEditingCell(null);
                                  setEditingValue("");
                                }
                              }}
                              /* ring-2 brand para feedback claro al editar notas inline */
                            className="w-full rounded border border-brand-400 px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                              type="number"
                              min="1"
                              max="10"
                              step="0.01"
                            />
                          ) : exam?.nota !== null &&
                            exam?.nota !== undefined ? (
                            Number(exam.nota).toFixed(2)
                          ) : exam?.ausente === 1 ? (
                            "Aus"
                          ) : (
                            "—"
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {showManualModal ? (
        <CargarNotaModal
          materiaId={Number(materiaId)}
          anio={anio}
          alumnos={rows}
          initialPayload={manualInitialPayload}
          onClose={() => setShowManualModal(false)}
          onGuardada={async () => {
            await loadNotas(materiaId, anio);
            setToast({
              type: "success",
              message: "Nota guardada correctamente.",
            });
          }}
        />
      ) : null}

      {showExcelModal ? (
        <ImportarExcelModal
          onClose={() => setShowExcelModal(false)}
          onImportada={async () => {
            await loadNotas(materiaId, anio);
            setToast({ type: "success", message: "Importación finalizada." });
          }}
        />
      ) : null}

      {toast ? (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
