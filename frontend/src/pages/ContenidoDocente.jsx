import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import ContentCardDocente from "../components/content/ContentCardDocente";
import ContentViewer from "../components/content/ContentViewer";
import SubirContenidoModal from "../components/content/SubirContenidoModal";

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-44 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
        />
      ))}
    </div>
  );
}

export default function ContenidoDocente() {
  const [materias, setMaterias] = useState([]);
  const [materiaSeleccionada, setMateriaSeleccionada] = useState(null);
  const [items, setItems] = useState([]);

  const [loadingLista, setLoadingLista] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState("");

  const [visorAbierto, setVisorAbierto] = useState(false);
  const [itemVisor, setItemVisor] = useState(null);
  const [visorError, setVisorError] = useState("");
  const [visorLoading, setVisorLoading] = useState(false);

  const [cardLoadingId, setCardLoadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [modalEliminar, setModalEliminar] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const [mostrarSubida, setMostrarSubida] = useState(false);

  const materiaActual = useMemo(
    () => materias.find((m) => m.id === materiaSeleccionada) || null,
    [materias, materiaSeleccionada],
  );

  const loadMaterias = async () => {
    setLoadingLista(true);
    setError("");

    try {
      const response = await api.get("/api/contenido/docente/mis-materias");
      const rows = response.data || [];
      setMaterias(rows);

      if (rows.length > 0) {
        const firstId = rows[0].id;
        setMateriaSeleccionada(firstId);
        await loadItems(firstId);
      }
    } catch (fetchError) {
      setError(fetchError.message || "No se pudieron cargar tus materias.");
    } finally {
      setLoadingLista(false);
    }
  };

  const loadItems = async (materiaId) => {
    setLoadingItems(true);
    setError("");

    try {
      const response = await api.get(
        `/api/contenido/docente/materia/${materiaId}`,
      );
      setItems(response.data?.items || []);
    } catch (fetchError) {
      if (
        (fetchError.message || "").toLowerCase().includes("asignación activa")
      ) {
        setError("No tenés acceso al contenido de esta materia.");
      } else {
        setError(fetchError.message || "No se pudo cargar el contenido.");
      }
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    loadMaterias();
  }, []);

  const handleSelectMateria = async (materiaId) => {
    if (materiaId === materiaSeleccionada) return;
    setMateriaSeleccionada(materiaId);
    await loadItems(materiaId);
  };

  const handleOpenItem = async (item) => {
    setCardLoadingId(item.id);
    setVisorAbierto(true);
    setVisorError("");
    setVisorLoading(true);

    try {
      const response = await api.get(`/api/contenido/docente/${item.id}`);
      setItemVisor(response.data);
    } catch (fetchError) {
      setItemVisor(null);
      setVisorError(
        fetchError.message || "No se pudo cargar el detalle del contenido.",
      );
    } finally {
      setVisorLoading(false);
      setCardLoadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!modalEliminar) return;

    setDeletingId(modalEliminar.id);
    setDeleteError("");

    try {
      await api.delete(`/api/contenido/${modalEliminar.id}`);
      setItems((prev) => prev.filter((item) => item.id !== modalEliminar.id));
      setModalEliminar(null);
    } catch (actionError) {
      setDeleteError(
        actionError.message ||
          "Solo podés eliminar contenido que vos mismo subiste.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Contenido académico
            </h2>
            <p className="mt-2 text-slate-600">
              Visualizá material del tutor/coordinador y gestioná tu contenido.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMostrarSubida(true)}
            disabled={!materiaActual}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            + Subir contenido
          </button>
        </div>
      </section>

      {error ? (
        <ErrorMessage message={error} onDismiss={() => setError("")} />
      ) : null}

      {loadingLista ? (
        <LoadingSpinner size="md" text="Cargando materias..." />
      ) : null}

      {!loadingLista && materias.length === 0 ? (
        <EmptyState
          icon="📭"
          title="No tenés materias asignadas actualmente."
          description="Contactá al coordinador."
        />
      ) : null}

      {!loadingLista && materias.length > 0 ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-2 sm:p-4">
            <div
              className="-mx-1 flex gap-2 overflow-x-auto px-1"
              role="tablist"
            >
              {materias.map((materia) => (
                <button
                  key={materia.id}
                  type="button"
                  role="tab"
                  aria-selected={materia.id === materiaSeleccionada}
                  onClick={() => handleSelectMateria(materia.id)}
                  className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition ${
                    materia.id === materiaSeleccionada
                      ? "bg-blue-100 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {materia.codigo} - {materia.nombre}
                </button>
              ))}
            </div>
          </section>

          {loadingItems ? <SkeletonGrid /> : null}

          {!loadingItems && items.length === 0 ? (
            <EmptyState
              icon="📚"
              title="No hay contenido disponible para esta materia todavía."
              description="Podés subir el primer material usando el botón superior."
            />
          ) : null}

          {!loadingItems && items.length > 0 ? (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <ContentCardDocente
                  key={item.id}
                  item={item}
                  onOpen={handleOpenItem}
                  onDelete={(target) => {
                    setDeleteError("");
                    setModalEliminar(target);
                  }}
                  deleting={deletingId === item.id}
                  loading={cardLoadingId === item.id}
                />
              ))}
            </section>
          ) : null}
        </>
      ) : null}

      {visorAbierto ? (
        <ContentViewer
          item={itemVisor}
          loading={visorLoading}
          error={visorError}
          onClose={() => {
            setVisorAbierto(false);
            setItemVisor(null);
            setVisorError("");
          }}
          onRetry={() => {
            if (itemVisor?.id) {
              handleOpenItem(itemVisor);
            }
          }}
        />
      ) : null}

      {mostrarSubida && materiaActual ? (
        <SubirContenidoModal
          materiaId={materiaActual.id}
          materiaNombre={materiaActual.nombre}
          onClose={() => setMostrarSubida(false)}
          onSubido={async () => {
            if (materiaSeleccionada) {
              await loadItems(materiaSeleccionada);
            }
          }}
        />
      ) : null}

      {modalEliminar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Eliminar contenido
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              ¿Eliminás "{modalEliminar.titulo}"? Esta acción no se puede
              deshacer.
            </p>

            {deleteError ? (
              <div className="mt-3">
                <ErrorMessage
                  message={deleteError}
                  onDismiss={() => setDeleteError("")}
                />
              </div>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalEliminar(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingId === modalEliminar.id}
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingId === modalEliminar.id ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
