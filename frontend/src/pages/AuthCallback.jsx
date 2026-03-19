import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";

const OAUTH_ERROR_MESSAGES = {
  oauth_cancelled: "Cancelaste el inicio de sesión con Google.",
  invalid_domain: "Solo se permiten cuentas institucionales @usal.edu.ar.",
  oauth_not_configured: "OAuth no está configurado en el servidor.",
  oauth_failed: "No se pudo completar la autenticación con Google.",
  server_error: "Error de servidor durante la autenticación.",
};

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeOAuthLogin } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    const errorCode = searchParams.get("error");

    if (errorCode) {
      const message =
        OAUTH_ERROR_MESSAGES[errorCode] || "No se pudo iniciar sesión.";
      sessionStorage.setItem("auth_error", message);
      navigate("/login", { replace: true });
      return;
    }

    if (!token) {
      sessionStorage.setItem("auth_error", "No se recibió un token válido.");
      navigate("/login", { replace: true });
      return;
    }

    try {
      completeOAuthLogin(token);
      navigate("/", { replace: true });
    } catch {
      sessionStorage.setItem(
        "auth_error",
        "La sesión recibida no es válida o ya expiró.",
      );
      navigate("/login", { replace: true });
    }
  }, [completeOAuthLogin, navigate, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <LoadingSpinner size="md" message="Completando inicio de sesión..." />
      </div>
    </main>
  );
}
