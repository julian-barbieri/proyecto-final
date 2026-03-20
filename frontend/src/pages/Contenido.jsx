import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import ContentCard from "../components/content/ContentCard";
import ContentViewer from "../components/content/ContentViewer";
import { useAuth } from "../context/AuthContext";

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-44 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
        />
      ))}
    </div>
  );
}

export default function Contenido() {
  const { user } = useAuth();

  const [materias, setMaterias] = useState([]);
  const [selectedMateriaId, setSelectedMateriaId] = useState(null);
  const [items, setItems] = useState([]);

  const [loadingMaterias, setLoadingMaterias] = useState(true);
  const [loadingContenido, setLoadingContenido] = useState(false);
  const [cardLoadingId, setCardLoadingId] = useState(null);
  const [error, setError] = useState("");

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerItem, setViewerItem] = useState(null);
  const [viewerError, setViewerError] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);
  const [activeContentId, setActiveContentId] = useState(null);

  const [seenIds, setSeenIds] = useState(new Set());

  const personalItems = useMemo(
    () => items.filter((item) => item.alumno_id === user?.id),
    [items, user?.id],
  );

  const generalItems = useMemo(
    () => items.filter((item) => item.alumno_id === null),
    [items],
  );

  const fetchContenidoByMateria = async (materiaId) => {
    setError("");
    setLoadingContenido(true);

    try {
      const response = await api.get(`/api/contenido/materias/${materiaId}`);
      setItems(response.data?.items || []);
    } catch (fetchError) {
      setItems([]);
      setError(fetchError.message || "No se pudo cargar el contenido.");
    } finally {
      setLoadingContenido(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadMaterias = async () => {
      setLoadingMaterias(true);
      setError("");

      try {
        const response = await api.get("/api/contenido/materias");
        const fetchedMaterias = response.data || [];

        if (!mounted) {
          return;
        }

        setMaterias(fetchedMaterias);

        if (fetchedMaterias.length > 0) {
          const firstMateriaId = fetchedMaterias[0].id;
          setSelectedMateriaId(firstMateriaId);
          await fetchContenidoByMateria(firstMateriaId);
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError.message || "No se pudieron cargar las materias.");
        }
      } finally {
        if (mounted) {
          setLoadingMaterias(false);
        }
      }
    };

    loadMaterias();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectMateria = async (materiaId) => {
    if (selectedMateriaId === materiaId) {
      return;
    }

    setSelectedMateriaId(materiaId);
    await fetchContenidoByMateria(materiaId);
  };

  const fetchDetalle = async (contenidoId) => {
    setViewerLoading(true);
    setViewerError("");

    try {
      const response = await api.get(`/api/contenido/${contenidoId}`);
      setViewerItem(response.data);
      setSeenIds((previous) => new Set(previous).add(contenidoId));
    } catch (fetchError) {
      setViewerItem(null);
      setViewerError(fetchError.message || "No se pudo cargar el detalle.");
    } finally {
      setViewerLoading(false);
      setCardLoadingId(null);
    }
  };

  const handleOpenContent = async (item) => {
    setCardLoadingId(item.id);
    setViewerOpen(true);
    setActiveContentId(item.id);
    setViewerItem(null);
    await fetchDetalle(item.id);
  };

  const handleCloseViewer = () => {
    setViewerOpen(false);
    setViewerItem(null);
    setViewerError("");
    setViewerLoading(false);
    setActiveContentId(null);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Contenido académico
        </h2>
        <p className="mt-2 text-slate-600">
          Accedé al material que subió tu tutor para cada materia.
        </p>
      </section>

      {error ? (
        <ErrorMessage message={error} onDismiss={() => setError("")} />
      ) : null}

      {loadingMaterias ? (
        <LoadingSpinner size="md" text="Cargando materias..." />
      ) : null}

      {!loadingMaterias && materias.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No tenés materias asignadas"
          description="Cuando estés inscripto en materias, vas a poder ver aquí el contenido publicado por tus tutores."
        />
      ) : null}

      {!loadingMaterias && materias.length > 0 ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-2 sm:p-4">
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Materias"
            >
              {materias.map((materia) => (
                <button
                  key={materia.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedMateriaId === materia.id}
                  onClick={() => handleSelectMateria(materia.id)}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                    selectedMateriaId === materia.id
                      ? "bg-blue-100 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {materia.codigo} - {materia.nombre}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            {loadingContenido ? <SkeletonGrid /> : null}

            {!loadingContenido && personalItems.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  📌 Para vos
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {personalItems.map((item) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      seen={seenIds.has(item.id)}
                      isLoading={cardLoadingId === item.id}
                      onClick={handleOpenContent}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {!loadingContenido && generalItems.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  📚 Para todos
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {generalItems.map((item) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      seen={seenIds.has(item.id)}
                      isLoading={cardLoadingId === item.id}
                      onClick={handleOpenContent}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {!loadingContenido &&
            personalItems.length === 0 &&
            generalItems.length === 0 ? (
              <EmptyState
                icon="📭"
                title="Sin contenido disponible"
                description="Tu tutor aún no subió contenido para esta materia."
              />
            ) : null}
          </section>
        </>
      ) : null}

      {viewerOpen ? (
        <ContentViewer
          item={viewerItem}
          loading={viewerLoading}
          error={viewerError}
          onRetry={() => {
            if (activeContentId) {
              fetchDetalle(activeContentId);
            }
          }}
          onClose={handleCloseViewer}
        />
      ) : null}
    </div>
  );
}
