import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-3xl"
        >
          🧭
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          404 — Página no encontrada
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          La ruta que buscás no existe o ya no está disponible.
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
