import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import ErrorMessage from "../ErrorMessage";

const TIPOS = [
  { value: "pdf", label: "PDF" },
  { value: "word", label: "Word" },
  { value: "video", label: "Video" },
  { value: "imagen", label: "Imagen" },
  { value: "texto", label: "Texto" },
];

const FILE_ACCEPT = {
  pdf: ".pdf",
  word: ".doc,.docx",
  imagen: ".jpg,.jpeg,.png,.gif",
};

function isValidVideoUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "").toLowerCase();
    return ["youtube.com", "youtu.be", "vimeo.com"].includes(host);
  } catch {
    return false;
  }
}

function formatFileSize(size) {
  if (!Number.isFinite(size)) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SubirContenidoModal({
  materiaId,
  materiaNombre,
  onClose,
  onSubido,
}) {
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    tipo: "pdf",
    destinatario: "todos",
    alumno_id: "",
    video_url: "",
    texto_contenido: "",
  });
  const [archivo, setArchivo] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(null);

  const requiresFile = useMemo(
    () => ["pdf", "word", "imagen"].includes(form.tipo),
    [form.tipo],
  );

  useEffect(() => {
    if (form.destinatario !== "individual") return;

    let active = true;
    const loadAlumnos = async () => {
      setLoadingAlumnos(true);
      try {
        const response = await api.get(
          `/api/gestion/alumnos-por-materia/${materiaId}`,
        );
        if (!active) return;
        setAlumnos(response.data || []);
      } catch {
        if (!active) return;
        setAlumnos([]);
      } finally {
        if (active) setLoadingAlumnos(false);
      }
    };

    loadAlumnos();
    return () => {
      active = false;
    };
  }, [form.destinatario, materiaId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }

    if (form.titulo.trim().length > 200) {
      setError("El título no puede superar 200 caracteres.");
      return;
    }

    if (form.descripcion.trim().length > 500) {
      setError("La descripción no puede superar 500 caracteres.");
      return;
    }

    if (form.tipo === "video" && !isValidVideoUrl(form.video_url.trim())) {
      setError("La URL debe ser de YouTube o Vimeo.");
      return;
    }

    if (form.tipo === "texto" && !form.texto_contenido.trim()) {
      setError("El contenido de texto es obligatorio.");
      return;
    }

    if (requiresFile && !archivo) {
      setError("Debés seleccionar un archivo para este tipo.");
      return;
    }

    if (form.destinatario === "individual" && !form.alumno_id) {
      setError("Seleccioná un alumno destinatario.");
      return;
    }

    setSubmitting(true);
    setUploadProgress(null);

    try {
      if (requiresFile) {
        const payload = new FormData();
        payload.append("titulo", form.titulo.trim());
        payload.append("descripcion", form.descripcion.trim());
        payload.append("tipo", form.tipo);
        payload.append("materia_id", String(materiaId));
        payload.append("destinatario", form.destinatario);
        if (form.destinatario === "individual") {
          payload.append("alumno_id", form.alumno_id);
        }
        payload.append("archivo", archivo);

        await api.post("/api/contenido", payload, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (eventProgress) => {
            if (!eventProgress?.total || archivo.size <= 1024 * 1024) return;
            const percent = Math.round(
              (eventProgress.loaded * 100) / eventProgress.total,
            );
            setUploadProgress(percent);
          },
        });
      } else {
        await api.post("/api/contenido", {
          titulo: form.titulo.trim(),
          descripcion: form.descripcion.trim(),
          tipo: form.tipo,
          materia_id: materiaId,
          destinatario: form.destinatario,
          alumno_id:
            form.destinatario === "individual" ? Number(form.alumno_id) : null,
          video_url: form.tipo === "video" ? form.video_url.trim() : null,
          texto_contenido:
            form.tipo === "texto" ? form.texto_contenido.trim() : null,
        });
      }

      if (onSubido) {
        onSubido();
      }
      onClose();
    } catch (submitError) {
      setError(submitError.message || "No se pudo subir el contenido.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Subir contenido — {materiaNombre}
            </h3>
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
          <ErrorMessage message={error} onDismiss={() => setError("")} />
        ) : null}

        <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Título
            </label>
            <input
              value={form.titulo}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, titulo: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Descripción
            </label>
            <textarea
              value={form.descripcion}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  descripcion: event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Tipo de contenido
              </label>
              <select
                value={form.tipo}
                onChange={(event) => {
                  const nextTipo = event.target.value;
                  setArchivo(null);
                  setForm((prev) => ({
                    ...prev,
                    tipo: nextTipo,
                    video_url: "",
                    texto_contenido: "",
                  }));
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {TIPOS.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Destinatario
              </label>
              <div className="space-y-2 rounded-md border border-slate-200 p-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={form.destinatario === "todos"}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        destinatario: "todos",
                        alumno_id: "",
                      }))
                    }
                  />
                  Para todo el curso
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={form.destinatario === "individual"}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        destinatario: "individual",
                      }))
                    }
                  />
                  Para un alumno específico
                </label>
              </div>
            </div>
          </div>

          {form.destinatario === "individual" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Alumno
              </label>
              <select
                value={form.alumno_id}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    alumno_id: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                disabled={loadingAlumnos}
              >
                <option value="">Seleccioná un alumno</option>
                {alumnos.map((alumno) => (
                  <option key={alumno.id} value={alumno.id}>
                    {alumno.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="transition-all duration-150">
            {form.tipo === "video" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  URL del video
                </label>
                <input
                  value={form.video_url}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      video_url: event.target.value,
                    }))
                  }
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            ) : null}

            {form.tipo === "texto" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Contenido de texto
                </label>
                <textarea
                  value={form.texto_contenido}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      texto_contenido: event.target.value,
                    }))
                  }
                  rows={8}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            ) : null}

            {requiresFile ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Archivo
                </label>
                <input
                  type="file"
                  accept={FILE_ACCEPT[form.tipo]}
                  onChange={(event) =>
                    setArchivo(event.target.files?.[0] || null)
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                {archivo ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {archivo.name} · {formatFileSize(archivo.size)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {uploadProgress !== null ? (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-600">
                Subiendo... {uploadProgress}%
              </p>
            </div>
          ) : null}

          <footer className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Subiendo..." : "Subir"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
