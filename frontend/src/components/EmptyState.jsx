export default function EmptyState({
  icon = "📭",
  title,
  description,
  action,
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center text-3xl">
        {typeof icon === "string" ? (
          <span aria-hidden="true">{icon}</span>
        ) : (
          icon
        )}
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
        {description}
      </p>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
