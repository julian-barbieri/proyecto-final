import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const OAUTH_ERROR_MESSAGES = {
  oauth_cancelled: "Cancelaste el inicio de sesión con Google.",
  invalid_domain: "Solo se permiten cuentas institucionales @usal.edu.ar.",
  oauth_not_configured: "OAuth no está configurado en el servidor.",
  oauth_failed: "No se pudo completar la autenticación con Google.",
  server_error: "Error de servidor durante la autenticación.",
};

export default function Login() {
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const oauthUrl = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";
    return `${apiBase}/api/auth/google`;
  }, []);

  useEffect(() => {
    const queryError = searchParams.get("error");

    if (queryError) {
      setError(
        OAUTH_ERROR_MESSAGES[queryError] || "No se pudo iniciar sesión.",
      );
      return;
    }

    const storedMessage = sessionStorage.getItem("auth_error");

    if (storedMessage) {
      setError(storedMessage);
      sessionStorage.removeItem("auth_error");
    }
  }, [searchParams]);

  const handleOAuthLogin = () => {
    setError("");
    setIsLoading(true);
    window.location.href = oauthUrl;
  };

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-xl font-semibold">
          Sistema de Predicciones Académicas
        </h2>
        <p className="mb-6 text-sm text-slate-600">
          Iniciá sesión con tu cuenta institucional{" "}
          <strong>@usal.edu.ar</strong>.
        </p>

        {error && (
          <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleOAuthLogin}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-3 rounded border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
            <path
              fill="#4285F4"
              d="M21.805 10.023H12.18v3.955h5.506c-.237 1.27-.948 2.347-2.022 3.067v2.55h3.273c1.915-1.764 3.02-4.365 3.02-7.455 0-.708-.064-1.388-.152-2.117z"
            />
            <path
              fill="#34A853"
              d="M12.18 22c2.73 0 5.02-.904 6.693-2.45l-3.273-2.55c-.904.607-2.06.97-3.42.97-2.63 0-4.86-1.777-5.66-4.168H3.136v2.62A10.11 10.11 0 0012.18 22z"
            />
            <path
              fill="#FBBC05"
              d="M6.52 13.8a6.08 6.08 0 010-3.6V7.58H3.136a10.11 10.11 0 000 8.84l3.384-2.62z"
            />
            <path
              fill="#EA4335"
              d="M12.18 6.03c1.484 0 2.816.51 3.866 1.514l2.896-2.896C17.196 2.977 14.91 2 12.18 2A10.11 10.11 0 003.136 7.58L6.52 10.2c.8-2.39 3.03-4.17 5.66-4.17z"
            />
          </svg>
          {isLoading ? "Redirigiendo..." : "Continuar con Google"}
        </button>

        <p className="mt-4 text-xs text-slate-500">
          Si necesitás usar cuentas de desarrollo, el endpoint tradicional sigue
          disponible en <code>/api/auth/login</code>.
        </p>
      </section>
    </main>
  );
}
