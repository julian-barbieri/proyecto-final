/**
 * Estado vacío reutilizable.
 * icon: acepta componente lucide-react (preferido) o string de texto como fallback.
 */
export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="rounded-lg border border-surface-border bg-white p-10 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
          {typeof icon === "string" ? (
            <span aria-hidden="true" className="text-2xl">{icon}</span>
          ) : (
            // SVG icon de lucide-react — tamaño estándar w-6 h-6
            <span className="[&>svg]:w-6 [&>svg]:h-6">{icon}</span>
          )}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500 leading-relaxed">
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
