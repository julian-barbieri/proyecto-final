import { useState } from "react";
import api from "../../api/axios";
import ErrorMessage from "../ErrorMessage";

const MAX_NOMBRE = 100;

export default function NuevaCarpetaModal({
  materiaId,
  materiaNombre,
  onClose,
  onCreada,
}) {
  const [nombre, setNombre] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const validate = () => {
    const trimmed = nombre.trim();

    if (!trimmed) {
      return "El nombre de la carpeta es obligatorio.";
    }

    if (trimmed.length > MAX_NOMBRE) {
      return "El nombre de la carpeta no puede superar 100 caracteres.";
    }

    if (
      trimmed.includes("/") ||
      trimmed.includes("\\") ||
      trimmed.includes("..")
    ) {
      return "El nombre de la carpeta no puede contener / \\ ni ..";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await api.post(
        `/api/gestion-contenido/materias/${materiaId}/carpetas`,
        {
          nombre: nombre.trim(),
        },
      );

      onCreada(response.data);
      onClose();
    } catch (sendError) {
      if ((sendError.message || "").includes("Ya existe")) {
        setError("Ya existe una carpeta con ese nombre en esta materia.");
      } else {
        setError(sendError.message || "No se pudo crear la carpeta.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Nueva carpeta
            </h3>
            <p className="text-sm text-slate-600">en {materiaNombre}</p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="mb-1 block text-sm font-medium text-slate-700"
              htmlFor="nombre_carpeta"
            >
              Nombre de la carpeta
            </label>
            <input
              id="nombre_carpeta"
              autoFocus
              value={nombre}
              maxLength={MAX_NOMBRE}
              onChange={(event) => {
                setNombre(event.target.value);
                setError("");
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-right text-xs text-slate-500">
              {nombre.length} / {MAX_NOMBRE}
            </p>
          </div>

          <footer className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Creando..." : "Crear"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
