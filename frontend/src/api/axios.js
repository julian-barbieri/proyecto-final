import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001",
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || "";

    if (status === 401 && !requestUrl.includes("/api/auth/login")) {
      localStorage.removeItem("auth_token");
      sessionStorage.setItem(
        "auth_error",
        "Tu sesión expiró o no es válida. Iniciá sesión nuevamente.",
      );
      window.location.href = "/login";
    }

    const serverMessage =
      error?.response?.data?.error || error?.response?.data?.message;

    const fallbackByStatus = {
      404: "Recurso no encontrado. Verificá que el backend esté actualizado y en ejecución.",
      403: "No tenés permisos para realizar esta acción.",
      422: "Datos de entrada inválidos.",
      500: "Error interno del servidor.",
      503: "El servicio no está disponible en este momento.",
    };

    const message =
      serverMessage ||
      fallbackByStatus[status] ||
      (!error?.response
        ? "No se pudo conectar con el servidor. Verificá tu conexión."
        : "Ocurrió un error inesperado.");

    return Promise.reject(new Error(message));
  },
);

export default api;
