import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// Nombres de roles legibles en español para la interfaz
const ROL_LABELS = {
  admin:       "Administrador",
  coordinador: "Coordinador",
  docente:     "Profesor",
  alumno:      "Alumno",
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!["alumno", "coordinador"].includes(user?.role)) {
      setUnreadMessages(0);
      return;
    }

    let active = true;

    const fetchUnread = async () => {
      try {
        const response = await api.get("/api/mensajes/no-leidos");
        if (active) {
          setUnreadMessages(Number(response.data?.total || 0));
        }
      } catch {
        if (active) setUnreadMessages(0);
      }
    };

    fetchUnread();
    const intervalId = window.setInterval(fetchUnread, 30000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [user?.role]);

  const links = useMemo(() => {
    const role = user?.role;

    if (["admin", "coordinador"].includes(role)) {
      return [
        { to: "/",                   label: "Dashboard" },
        { to: "/gestion-materias",   label: "Gestión de materias" },
        { to: "/panel-predicciones", label: "Panel de Predicciones" },
        ...(role === "coordinador"
          ? [{ to: "/mensajes", label: "Mensajes" }]
          : []),
      ];
    }

    // Profesores: solo ven el Panel de Predicciones (requerimiento explícito)
    if (role === "docente") {
      return [
        { to: "/panel-predicciones", label: "Panel de Predicciones" },
      ];
    }

    if (role === "alumno") {
      return [
        { to: "/",            label: "Dashboard" },
        { to: "/mis-cursos",  label: "Mis cursos" },
        { to: "/mis-notas",   label: "Mis notas" },
        { to: "/mensajes",    label: "Mensajes" },
        { to: "/inscripcion", label: "Inscripción" },
      ];
    }

    return [{ to: "/", label: "Dashboard" }];
  }, [user?.role]);

  const displayName = user?.nombre_completo || user?.username || "Usuario";
  const displayEmail = user?.email || "";
  const userInitial = displayName?.trim()?.[0]?.toUpperCase() || "U";
  const roleLabel = ROL_LABELS[user?.role] || user?.role || "Sin rol";

  // Link activo: fondo institucional leve + texto brand + negrita
  const linkClassName = ({ isActive }) =>
    `rounded-md px-3 py-1.5 text-sm transition-colors ${
      isActive
        ? "bg-brand-50 text-brand-700 font-semibold"
        : "text-slate-600 hover:bg-surface-hover hover:text-slate-900"
    }`;

  return (
    /* border-t-[3px] crea la franja de acento institucional en la parte superior */
    <header className="border-t-[3px] border-t-brand-700 border-b border-surface-border bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">

        {/* Logo + nombre del sistema */}
        <div className="flex items-center gap-3">
          <img src="/logo-usal.webp" alt="Logo USAL" className="h-9 w-auto" />
          <h1 className="text-base font-semibold text-slate-900 leading-tight">
            Predicciones Académicas
          </h1>
        </div>

        {/* Navegación desktop */}
        <div className="hidden items-center gap-4 md:flex">
          <nav className="flex items-center gap-1" aria-label="Navegación principal">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClassName}>
                <span className="relative inline-flex items-center gap-1.5">
                  {link.label}
                  {link.to === "/mensajes" && unreadMessages > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </span>
              </NavLink>
            ))}
          </nav>

          {/* Chip del usuario: avatar + nombre + rol */}
          <div className="flex items-center gap-2.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 flex-shrink-0"
              aria-hidden="true"
            >
              {userInitial}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-medium text-slate-800">{displayName}</p>
              {displayEmail && (
                <p className="text-xs text-slate-400">{displayEmail}</p>
              )}
              {/* Rol en español — evita exponer nombres técnicos internos */}
              <p className="text-[11px] font-medium text-brand-600">{roleLabel}</p>
            </div>
          </div>

          {/* Logout discreto: solo texto, no compite visualmente con la nav */}
          <button
            type="button"
            onClick={logout}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors px-2 py-1 rounded-md hover:bg-surface-hover"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Botón hamburguesa mobile */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="rounded-md p-2 text-slate-700 hover:bg-surface-hover md:hidden"
          aria-label="Abrir menú de navegación"
          aria-expanded={isMobileMenuOpen}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      {/* Overlay para cerrar el menú mobile */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-200 md:hidden ${
          isMobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Menú desplegable mobile */}
      <div
        className={`absolute inset-x-0 top-[57px] z-50 origin-top transform bg-white shadow-lg transition-all duration-200 md:hidden ${
          isMobileMenuOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 sm:px-6">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClassName}>
                <span className="relative inline-flex items-center gap-1.5">
                  {link.label}
                  {link.to === "/mensajes" && unreadMessages > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-2 flex items-center gap-3 rounded-lg border border-surface-border p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {userInitial}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-medium text-slate-800">{displayName}</p>
              {displayEmail && <p className="text-xs text-slate-400">{displayEmail}</p>}
              <p className="text-[11px] font-medium text-brand-600">{roleLabel}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-surface-border px-4 py-2 text-sm text-slate-600 hover:bg-surface-hover transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
