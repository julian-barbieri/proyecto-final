import Navbar from "./Navbar";

/**
 * Envuelve todas las páginas protegidas.
 * Props:
 *   title    — título principal de la página (usa Crimson Pro via CSS global)
 *   subtitle — descripción corta bajo el título
 *   icon     — componente lucide-react opcional para el ícono junto al título
 *   actions  — slot derecho para botones de acción contextuales
 */
export default function PageLayout({ children, title, subtitle, icon, actions }) {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {title && (
          <header className="mb-6 pb-5 border-b border-surface-border flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              {/* Ícono opcional: muestra color brand con fondo suave */}
              {icon && (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 flex-shrink-0">
                  {icon}
                </div>
              )}
              <div>
                {/* h1 hereda font-heading (Crimson Pro) via index.css @layer base */}
                <h1 className="text-2xl font-semibold text-slate-900 leading-tight">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
                )}
              </div>
            </div>
            {actions && (
              <div className="flex-shrink-0">{actions}</div>
            )}
          </header>
        )}
        {children}
      </main>
    </div>
  );
}
