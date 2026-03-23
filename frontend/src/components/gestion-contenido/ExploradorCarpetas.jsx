import { useMemo, useRef, useState } from "react";
import api from "../../api/axios";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const allowedExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".txt",
]);

function getFileExtension(name) {
  const dotIndex = String(name || "").lastIndexOf(".");
  if (dotIndex < 0) return "";
  return String(name).slice(dotIndex).toLowerCase();
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function iconByTipo(tipo) {
  if (tipo === "pdf") return "📄";
  if (tipo === "word") return "📝";
  if (tipo === "imagen") return "🖼";
  if (tipo === "texto") return "📃";
  return "📄";
}

function colorByTipo(tipo) {
  if (tipo === "pdf") return "text-red-600";
  if (tipo === "word") return "text-blue-600";
  if (tipo === "imagen") return "text-emerald-600";
  if (tipo === "texto") return "text-slate-600";
  return "text-slate-600";
}

export default function ExploradorCarpetas({
  carpetas,
  carpetaActiva,
  onToggleCarpeta,
  onArchivoEliminado,
  onCarpetaEliminada,
  onArchivosSubidos,
  onToast,
}) {
  const fileInputRef = useRef(null);
  const activeInputCarpetaRef = useRef(null);

  const [dragOverCarpetaId, setDragOverCarpetaId] = useState(null);
  const [selectedByCarpeta, setSelectedByCarpeta] = useState({});
  const [failedByCarpeta, setFailedByCarpeta] = useState({});
  const [uploadingCarpetaId, setUploadingCarpetaId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [deletingArchivoId, setDeletingArchivoId] = useState(null);
  const [confirmArchivoId, setConfirmArchivoId] = useState(null);

  const [confirmDeleteCarpeta, setConfirmDeleteCarpeta] = useState(null);
  const [deletingCarpetaId, setDeletingCarpetaId] = useState(null);

  const isMobile = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(max-width: 767px)").matches;
  }, []);

  const buildValidatedFiles = (filesLike) => {
    return Array.from(filesLike || []).map((file) => {
      const extension = getFileExtension(file.name);

      if (!allowedExtensions.has(extension)) {
        return {
          file,
          valid: false,
          error: "Tipo no permitido",
        };
      }

      if (Number(file.size) > MAX_FILE_SIZE) {
        return {
          file,
          valid: false,
          error: "Supera 20 MB",
        };
      }

      return {
        file,
        valid: true,
        error: "",
      };
    });
  };

  const setSelectedFiles = (carpetaId, filesLike) => {
    const nextList = buildValidatedFiles(filesLike);
    setSelectedByCarpeta((prev) => ({ ...prev, [carpetaId]: nextList }));
    setFailedByCarpeta((prev) => ({ ...prev, [carpetaId]: [] }));
  };

  const openFilePicker = (carpetaId) => {
    activeInputCarpetaRef.current = carpetaId;
    fileInputRef.current?.click();
  };

  const handleDeleteArchivo = async (archivoId) => {
    setDeletingArchivoId(archivoId);

    try {
      await api.delete(`/api/gestion-contenido/archivos/${archivoId}`);
      onArchivoEliminado(archivoId);
      setConfirmArchivoId(null);
      onToast?.("Archivo eliminado correctamente.", "success");
    } catch (error) {
      onToast?.(error.message || "No se pudo eliminar el archivo.", "error");
    } finally {
      setDeletingArchivoId(null);
    }
  };

  const handleDeleteCarpeta = async () => {
    if (!confirmDeleteCarpeta) return;

    setDeletingCarpetaId(confirmDeleteCarpeta.id);

    try {
      const response = await api.delete(
        `/api/gestion-contenido/carpetas/${confirmDeleteCarpeta.id}`,
      );

      const removedCount = Number(response.data?.archivos_eliminados || 0);
      onCarpetaEliminada(confirmDeleteCarpeta.id);
      onToast?.(
        `Carpeta eliminada. Se eliminaron ${removedCount} archivos.`,
        "success",
      );
      setConfirmDeleteCarpeta(null);
    } catch (error) {
      onToast?.(error.message || "No se pudo eliminar la carpeta.", "error");
    } finally {
      setDeletingCarpetaId(null);
    }
  };

  const handleUpload = async (carpetaId) => {
    const selected = selectedByCarpeta[carpetaId] || [];
    const valid = selected
      .filter((item) => item.valid)
      .map((item) => item.file);

    if (!valid.length) {
      return;
    }

    const formData = new FormData();
    for (const file of valid) {
      formData.append("archivos", file);
    }

    setUploadingCarpetaId(carpetaId);
    setUploadProgress(0);

    try {
      const response = await api.post(
        `/api/gestion-contenido/carpetas/${carpetaId}/archivos`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (event) => {
            if (!event?.total) return;
            const progress = Math.round((event.loaded * 100) / event.total);
            setUploadProgress(progress);
          },
        },
      );

      const subidos = response.data?.subidos || [];
      const fallidos = response.data?.fallidos || [];

      onArchivosSubidos(carpetaId, subidos);
      setFailedByCarpeta((prev) => ({ ...prev, [carpetaId]: fallidos }));
      setSelectedByCarpeta((prev) => ({ ...prev, [carpetaId]: [] }));

      if (fallidos.length > 0) {
        onToast?.(
          `Se subieron ${subidos.length} de ${subidos.length + fallidos.length} archivos. Ver detalles.`,
          "success",
        );
      } else {
        onToast?.(
          `Se subieron ${subidos.length} archivos correctamente.`,
          "success",
        );
      }
    } catch (error) {
      onToast?.(error.message || "No se pudieron subir los archivos.", "error");
    } finally {
      setUploadingCarpetaId(null);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt"
        onChange={(event) => {
          const targetCarpetaId = activeInputCarpetaRef.current;
          if (!targetCarpetaId) {
            return;
          }

          setSelectedFiles(targetCarpetaId, event.target.files);
          event.target.value = "";
        }}
      />

      {carpetas.map((carpeta) => {
        const isOpen = carpetaActiva === carpeta.id;
        const selected = selectedByCarpeta[carpeta.id] || [];
        const selectedValidCount = selected.filter((item) => item.valid).length;
        const selectedInvalidCount = selected.filter(
          (item) => !item.valid,
        ).length;
        const failedUploads = failedByCarpeta[carpeta.id] || [];

        return (
          <article
            key={carpeta.id}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <button
              type="button"
              onClick={() => onToggleCarpeta(isOpen ? null : carpeta.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  📁 {carpeta.nombre}
                </p>
                <p className="text-xs text-slate-500">
                  ({carpeta.archivos?.length || 0} archivos)
                </p>
              </div>
              <span className="text-slate-500">{isOpen ? "▼" : "►"}</span>
            </button>

            {isOpen ? (
              <div className="space-y-4 border-t border-slate-200 p-4">
                {carpeta.archivos?.length ? (
                  <div className="space-y-2">
                    {carpeta.archivos.map((archivo) => (
                      <div
                        key={archivo.id}
                        className="rounded-md border border-slate-200 px-3 py-2"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-slate-800">
                              <span className={colorByTipo(archivo.tipo)}>
                                {iconByTipo(archivo.tipo)}
                              </span>{" "}
                              {archivo.nombre_archivo}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 self-start md:self-auto">
                            <a
                              href={archivo.archivo_url || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className={`rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 ${
                                archivo.archivo_url
                                  ? "hover:bg-slate-50"
                                  : "pointer-events-none opacity-50"
                              }`}
                            >
                              ⬇ Descargar
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmArchivoId(
                                  confirmArchivoId === archivo.id
                                    ? null
                                    : archivo.id,
                                )
                              }
                              className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                              🗑
                            </button>
                          </div>
                        </div>

                        {confirmArchivoId === archivo.id ? (
                          <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                            <p className="text-slate-700">
                              ¿Eliminás "{archivo.nombre_archivo}"?
                            </p>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                disabled={deletingArchivoId === archivo.id}
                                onClick={() => handleDeleteArchivo(archivo.id)}
                                className="rounded border border-red-200 px-2 py-1 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                              >
                                Sí
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmArchivoId(null)}
                                className="rounded border border-slate-300 px-2 py-1 font-medium text-slate-700 hover:bg-white"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Esta carpeta está vacía.
                  </p>
                )}

                <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <div
                    onDragOver={(event) => {
                      if (isMobile) return;
                      event.preventDefault();
                      setDragOverCarpetaId(carpeta.id);
                    }}
                    onDragLeave={() => setDragOverCarpetaId(null)}
                    onDrop={(event) => {
                      if (isMobile) return;
                      event.preventDefault();
                      setDragOverCarpetaId(null);
                      setSelectedFiles(carpeta.id, event.dataTransfer.files);
                    }}
                    onClick={() => openFilePicker(carpeta.id)}
                    className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                      dragOverCarpetaId === carpeta.id
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-700">
                      {isMobile
                        ? "Tocá para seleccionar archivos"
                        : "Arrastrá archivos aquí o hacé clic para seleccionar"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Tipos: PDF, Word, imágenes, txt
                    </p>
                  </div>

                  {selected.length > 0 ? (
                    <div className="space-y-1">
                      {selected.map((item, index) => (
                        <div
                          key={`${item.file.name}-${index}`}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="truncate pr-2 text-slate-700">
                            {item.file.name} · {formatFileSize(item.file.size)}
                          </span>
                          <span
                            className={
                              item.valid ? "text-emerald-600" : "text-red-600"
                            }
                          >
                            {item.valid ? "✓ Listo" : `✗ ${item.error}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {uploadingCarpetaId === carpeta.id ? (
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

                  {failedUploads.length > 0 ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      <p className="font-semibold">Archivos con error</p>
                      <ul className="mt-1 space-y-1">
                        {failedUploads.map((item, index) => (
                          <li key={`${item.nombre_archivo}-${index}`}>
                            {item.nombre_archivo}: {item.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      onClick={() => handleUpload(carpeta.id)}
                      disabled={
                        uploadingCarpetaId === carpeta.id ||
                        selectedValidCount === 0
                      }
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Subir {selectedValidCount} archivos
                    </button>
                    {selectedInvalidCount > 0 ? (
                      <p className="text-xs text-red-600">
                        {selectedInvalidCount} archivos fueron rechazados por
                        validación.
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={deletingCarpetaId === carpeta.id}
                      onClick={() => setConfirmDeleteCarpeta(carpeta)}
                      className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      🗑 Eliminar carpeta
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}

      {confirmDeleteCarpeta ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Eliminar carpeta
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              ¿Eliminás la carpeta "{confirmDeleteCarpeta.nombre}" y todos sus
              archivos? Esta acción no se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteCarpeta(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingCarpetaId === confirmDeleteCarpeta.id}
                onClick={handleDeleteCarpeta}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingCarpetaId === confirmDeleteCarpeta.id
                  ? "Eliminando..."
                  : "Eliminar carpeta"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
