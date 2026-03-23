import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import ExploradorCarpetas from "../components/gestion-contenido/ExploradorCarpetas";
import NuevaCarpetaModal from "../components/gestion-contenido/NuevaCarpetaModal";

function CarpetasSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
        />
      ))}
    </div>
  );
}

export default function GestionContenido() {
  const [materias, setMaterias] = useState([]);
  const [materiaSeleccionada, setMateriaSeleccionada] = useState(null);
  const [carpetas, setCarpetas] = useState([]);
  const [carpetaActiva, setCarpetaActiva] = useState(null);
  const [loadingMaterias, setLoadingMaterias] = useState(true);
  const [loadingCarpetas, setLoadingCarpetas] = useState(false);
  const [error, setError] = useState("");
  const [showNuevaCarpetaModal, setShowNuevaCarpetaModal] = useState(false);
  const [toast, setToast] = useState(null);

  const materiaActiva = useMemo(
    () => materias.find((item) => item.id === materiaSeleccionada) || null,
    [materias, materiaSeleccionada],
  );

  const showToast = (message, type = "success") => {
    setToast({ message, type, key: Date.now() });
  };

  const loadMaterias = async () => {
    setLoadingMaterias(true);
    setError("");

    try {
      const response = await api.get("/api/gestion-contenido/materias");
      const rows = response.data || [];

      setMaterias(rows);

      if (rows.length > 0) {
        const firstMateriaId = Number(rows[0].id);
        setMateriaSeleccionada(firstMateriaId);
        await loadCarpetas(firstMateriaId);
      } else {
        setMateriaSeleccionada(null);
        setCarpetas([]);
      }
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar las materias.");
    } finally {
      setLoadingMaterias(false);
    }
  };

  const loadCarpetas = async (materiaId) => {
    setLoadingCarpetas(true);
    setError("");

    try {
      const response = await api.get(
        `/api/gestion-contenido/materias/${materiaId}/carpetas`,
      );

      setCarpetas(response.data || []);
      setCarpetaActiva(null);
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar las carpetas.");
      setCarpetas([]);
    } finally {
      setLoadingCarpetas(false);
    }
  };

  useEffect(() => {
    loadMaterias();
  }, []);

  const handleMateriaChange = async (value) => {
    const materiaId = Number(value);
    setMateriaSeleccionada(materiaId);
    await loadCarpetas(materiaId);
  };

  const handleCarpetaCreada = (carpeta) => {
    setCarpetas((prev) =>
      [...prev, carpeta].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
    setCarpetaActiva(carpeta.id);
    showToast(`Carpeta '${carpeta.nombre}' creada correctamente.`, "success");

    setMaterias((prev) =>
      prev.map((item) =>
        item.id === materiaSeleccionada
          ? { ...item, total_carpetas: Number(item.total_carpetas || 0) + 1 }
          : item,
      ),
    );
  };

  const handleCarpetaEliminada = (carpetaId) => {
    setCarpetas((prev) => prev.filter((carpeta) => carpeta.id !== carpetaId));

    if (carpetaActiva === carpetaId) {
      setCarpetaActiva(null);
    }

    setMaterias((prev) =>
      prev.map((item) =>
        item.id === materiaSeleccionada
          ? {
              ...item,
              total_carpetas: Math.max(0, Number(item.total_carpetas || 0) - 1),
            }
          : item,
      ),
    );
  };

  const handleArchivoEliminado = (archivoId) => {
    setCarpetas((prev) =>
      prev.map((carpeta) => ({
        ...carpeta,
        archivos: (carpeta.archivos || []).filter(
          (archivo) => archivo.id !== archivoId,
        ),
      })),
    );
  };

  const handleArchivosSubidos = (carpetaId, nuevosArchivos) => {
    setCarpetas((prev) =>
      prev.map((carpeta) => {
        if (carpeta.id !== carpetaId) {
          return carpeta;
        }

        return {
          ...carpeta,
          archivos: [...(nuevosArchivos || []), ...(carpeta.archivos || [])],
        };
      }),
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="w-full max-w-lg">
            <label
              className="mb-1 block text-sm font-medium text-slate-700"
              htmlFor="materia_gestion_contenido"
            >
              Materia
            </label>
            <select
              id="materia_gestion_contenido"
              value={materiaSeleccionada || ""}
              onChange={(event) => handleMateriaChange(event.target.value)}
              disabled={loadingMaterias || materias.length === 0}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {materias.map((materia) => (
                <option key={materia.id} value={materia.id}>
                  {materia.codigo} - {materia.nombre}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowNuevaCarpetaModal(true)}
            disabled={!materiaSeleccionada}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            + Nueva carpeta
          </button>
        </div>
      </section>

      {error ? (
        <ErrorMessage message={error} onDismiss={() => setError("")} />
      ) : null}

      {loadingMaterias ? (
        <LoadingSpinner size="md" text="Cargando materias..." />
      ) : materias.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No hay materias disponibles en el sistema."
          description="Cuando existan materias, vas a poder gestionar carpetas y archivos acá."
        />
      ) : loadingCarpetas ? (
        <CarpetasSkeleton />
      ) : carpetas.length === 0 ? (
        <EmptyState
          icon="📁"
          title="Esta materia no tiene carpetas todavía."
          description="Creá carpetas para organizar el contenido de la materia."
          action={{
            label: "Crear primera carpeta",
            onClick: () => setShowNuevaCarpetaModal(true),
          }}
        />
      ) : (
        <ExploradorCarpetas
          carpetas={carpetas}
          carpetaActiva={carpetaActiva}
          onToggleCarpeta={setCarpetaActiva}
          onArchivoEliminado={handleArchivoEliminado}
          onCarpetaEliminada={handleCarpetaEliminada}
          onArchivosSubidos={handleArchivosSubidos}
          onToast={showToast}
        />
      )}

      {showNuevaCarpetaModal && materiaActiva ? (
        <NuevaCarpetaModal
          materiaId={materiaActiva.id}
          materiaNombre={materiaActiva.nombre}
          onClose={() => setShowNuevaCarpetaModal(false)}
          onCreada={handleCarpetaCreada}
        />
      ) : null}

      {toast ? (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
