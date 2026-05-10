import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const OAUTH_ERROR_MESSAGES = {
  oauth_cancelled:    "Cancelaste el inicio de sesión con Google.",
  invalid_domain:     "Solo se permiten cuentas institucionales @usal.edu.ar.",
  oauth_not_configured: "OAuth no está configurado en el servidor.",
  oauth_failed:       "No se pudo completar la autenticación con Google.",
  server_error:       "Error de servidor durante la autenticación.",
};

export default function Login() {
  const [searchParams]    = useSearchParams();
  const { isAuthenticated, login } = useAuth();

  const [isLoading,        setIsLoading]        = useState(false);
  const [isSubmittingLocal,setIsSubmittingLocal] = useState(false);
  const [error,            setError]            = useState("");
  const [form,             setForm]             = useState({ username: "", password: "" });

  const oauthUrl = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";
    return `${apiBase}/api/auth/google`;
  }, []);

  useEffect(() => {
    const queryError  = searchParams.get("error");
    if (queryError) {
      setError(OAUTH_ERROR_MESSAGES[queryError] || "No se pudo iniciar sesión.");
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

  const handleLocalLogin = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmittingLocal(true);
    try {
      await login(form.username, form.password);
    } catch (err) {
      setError(err?.message || "No se pudo iniciar sesión.");
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    /*
     * Fondo degradado brand-900→brand-700: transmite identidad institucional
     * desde el primer momento, diferencia la app de herramientas genéricas.
     */
    <main className="flex min-h-screen items-center justify-center px-4 bg-gradient-to-br from-brand-900 to-brand-700">
      <section
        className="w-full max-w-md rounded-xl border border-white/10 bg-white p-8 shadow-2xl"
        aria-label="Formulario de inicio de sesión"
      >
        {/* Logo y título — mayor presencia visual que la versión original */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/logo-usal.webp" alt="Logo USAL" className="h-24 w-auto" />
          {/* font-heading (Crimson Pro) da tono académico al título */}
          <h1 className="font-heading text-2xl font-semibold text-slate-900 leading-tight">
            Sistema de Predicciones Académicas
          </h1>
          <p className="text-sm text-slate-500">
            Iniciá sesión con tu cuenta institucional{" "}
            <strong className="text-slate-700">@usal.edu.ar</strong>.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Botón OAuth: brand-600 en lugar del gris genérico original */}
        <button
          type="button"
          onClick={handleOAuthLogin}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-100 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
        >
          {/* Logo de Google — SVG inline para evitar dependencia de CDN */}
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 flex-shrink-0">
            <path fill="#4285F4" d="M21.805 10.023H12.18v3.955h5.506c-.237 1.27-.948 2.347-2.022 3.067v2.55h3.273c1.915-1.764 3.02-4.365 3.02-7.455 0-.708-.064-1.388-.152-2.117z"/>
            <path fill="#34A853" d="M12.18 22c2.73 0 5.02-.904 6.693-2.45l-3.273-2.55c-.904.607-2.06.97-3.42.97-2.63 0-4.86-1.777-5.66-4.168H3.136v2.62A10.11 10.11 0 0012.18 22z"/>
            <path fill="#FBBC05" d="M6.52 13.8a6.08 6.08 0 010-3.6V7.58H3.136a10.11 10.11 0 000 8.84l3.384-2.62z"/>
            <path fill="#EA4335" d="M12.18 6.03c1.484 0 2.816.51 3.866 1.514l2.896-2.896C17.196 2.977 14.91 2 12.18 2A10.11 10.11 0 003.136 7.58L6.52 10.2c.8-2.39 3.03-4.17 5.66-4.17z"/>
          </svg>
          {isLoading ? "Redirigiendo..." : "Continuar con Google"}
        </button>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-surface-border" />
          <span className="text-xs uppercase tracking-wider text-slate-400">o</span>
          <span className="h-px flex-1 bg-surface-border" />
        </div>

        {/* Formulario local — para cuentas de prueba precargadas */}
        <form onSubmit={handleLocalLogin} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              className="w-full rounded-lg border border-surface-border px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              placeholder="Ej: director"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              className="w-full rounded-lg border border-surface-border px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              placeholder="Tu contraseña"
              required
              autoComplete="current-password"
            />
          </div>

          {/* brand-700 en lugar del oscuro slate-800 — mantiene paleta institucional */}
          <button
            type="submit"
            disabled={isSubmittingLocal || isLoading}
            className="w-full rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmittingLocal ? "Ingresando..." : "Ingresar con usuario"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400 text-center">
          También podés usar usuario y contraseña precargados en la base de datos.
        </p>
      </section>
    </main>
  );
}
