import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!["alumno", "docente", "coordinador"].includes(user?.role)) {
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
        if (active) {
          setUnreadMessages(0);
        }
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
        { to: "/", label: "Dashboard" },
        { to: "/gestion-materias", label: "Gestión de materias" },
        { to: "/gestion-contenido", label: "Gestión de contenido" },
        { to: "/predicciones", label: "Predicciones" },
        ...(role === "coordinador"
          ? [{ to: "/mensajes", label: "Mensajes" }]
          : []),
        ...(role === "admin" ? [{ to: "/alumnos", label: "Alumnos" }] : []),
      ];
    }

    if (role === "docente") {
      return [
        { to: "/", label: "Dashboard" },
        { to: "/mis-materias", label: "Mis materias" },
        { to: "/mensajes", label: "Mensajes" },
        { to: "/contenido-docente", label: "Contenido" },
      ];
    }

    if (role === "alumno") {
      return [
        { to: "/", label: "Dashboard" },
        { to: "/contenido", label: "Contenido" },
        { to: "/mensajes", label: "Mensajes" },
        { to: "/mis-cursos", label: "Mis cursos" },
        { to: "/inscripcion", label: "Inscripción" },
      ];
    }

    return [{ to: "/", label: "Dashboard" }];
  }, [user?.role]);

  const displayName = user?.nombre_completo || user?.username || "Usuario";
  const displayEmail = user?.email || "Sin correo";
  const userInitial = displayName?.trim()?.[0]?.toUpperCase() || "U";

  const linkClassName = ({ isActive }) =>
    `rounded px-3 py-1.5 text-sm ${isActive ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <img src="/logo-usal.webp" alt="Logo USAL" className="h-9 w-auto" />
          <h1 className="text-lg font-semibold text-slate-900">
            Predicciones Académicas
          </h1>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <nav className="flex items-center gap-2">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClassName}>
                <span className="relative inline-flex items-center gap-1">
                  {link.label}
                  {link.to === "/mensajes" && unreadMessages > 0 ? (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              {userInitial}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-medium text-slate-800">
                {displayName}
              </p>
              <p className="text-xs text-slate-500">{displayEmail}</p>
              <p className="text-[11px] text-slate-500 capitalize">
                {user?.role || "sin rol"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            Cerrar sesión
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="rounded p-2 text-slate-700 hover:bg-slate-100 md:hidden"
          aria-label="Abrir menú"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-200 md:hidden ${
          isMobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <div
        className={`absolute inset-x-0 top-[57px] z-50 origin-top transform bg-white shadow-lg transition-all duration-200 md:hidden ${
          isMobileMenuOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 sm:px-6">
          <nav className="flex flex-col gap-2">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClassName}>
                <span className="relative inline-flex items-center gap-1">
                  {link.label}
                  {link.to === "/mensajes" && unreadMessages > 0 ? (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              {userInitial}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-medium text-slate-800">
                {displayName}
              </p>
              <p className="text-xs text-slate-500">{displayEmail}</p>
              <p className="text-[11px] text-slate-500 capitalize">
                {user?.role || "sin rol"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
