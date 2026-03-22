import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";
import InscripcionCard from "../components/gestion/InscripcionCard";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR").format(date);
}

export default function Inscripcion() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState("inscribir");
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState(null);

  const periodoActivo = useMemo(() => {
    if (!items.length) return null;
    return items[0].periodo_activo || null;
  }, [items]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/api/gestion/inscripcion/disponibles");
      setItems(response.data || []);
    } catch (fetchError) {
      setError(
        fetchError.message || "No se pudo cargar la inscripción a materias.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openInscribirModal = (item) => {
    setSelectedItem(item);
    setModalAction("inscribir");
    setModalError("");
    setModalOpen(true);
  };

  const openBajaModal = (item) => {
    setSelectedItem(item);
    setModalAction("baja");
    setModalError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedItem(null);
    setModalError("");
  };

  const handleConfirm = async () => {
    if (!selectedItem) return;

    setSubmitting(true);
    setModalError("");

    try {
      if (modalAction === "inscribir") {
        await api.post("/api/gestion/inscripcion", {
          materia_id: selectedItem.materia_id,
        });

        setToast({
          type: "success",
          message: `¡Te inscribiste exitosamente en ${selectedItem.materia_nombre}!`,
        });
      } else {
        await api.delete(`/api/gestion/inscripcion/${selectedItem.materia_id}`);
        setToast({
          type: "success",
          message: `Inscripción dada de baja en ${selectedItem.materia_nombre}.`,
        });
      }

      closeModal();
      await loadData();
    } catch (submitError) {
      setModalError(
        submitError.message || "No se pudo completar la operación.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Inscripción a materias
        </h2>
        {periodoActivo ? (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <p className="font-medium">
              📅 Período activo:{" "}
              {periodoActivo.descripcion || "Período vigente"}
            </p>
            <p className="mt-1">
              Cierra el {formatDate(periodoActivo.fecha_fin)}
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Las inscripciones están cerradas actualmente.
          </div>
        )}
      </section>

      {error ? (
        <ErrorMessage message={error} onDismiss={() => setError("")} />
      ) : null}

      {loading ? (
        <LoadingSpinner size="md" text="Cargando materias..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No hay materias para inscripción"
          description="No hay materias habilitadas en este momento."
        />
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((item) => (
            <InscripcionCard
              key={item.materia_id}
              item={item}
              periodoActivo={Boolean(periodoActivo)}
              onInscribir={openInscribirModal}
              onBaja={openBajaModal}
            />
          ))}
        </section>
      )}

      {modalOpen && selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {modalAction === "inscribir"
                ? "Confirmar inscripción"
                : "Confirmar baja"}
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              {modalAction === "inscribir"
                ? `¿Confirmás tu inscripción en ${selectedItem.materia_nombre} para el año ${new Date().getFullYear()}?`
                : `¿Confirmás que querés darte de baja de ${selectedItem.materia_nombre}? Esta acción solo está disponible mientras el período esté activo.`}
            </p>

            {modalError ? (
              <div className="mt-3">
                <ErrorMessage
                  message={modalError}
                  onDismiss={() => setModalError("")}
                />
              </div>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirm}
                className={`rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60 ${
                  modalAction === "inscribir"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {submitting
                  ? "Procesando..."
                  : modalAction === "inscribir"
                    ? "Inscribirme"
                    : "Dar de baja"}
              </button>
            </div>
          </div>
        </div>
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
