export default function ErrorMessage({ message, onDismiss }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 transition-opacity duration-300">
      <div className="flex items-start gap-3">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6" />
        </svg>

        <p className="flex-1 text-sm font-medium">{message}</p>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar mensaje de error"
            className="rounded p-1 text-red-600 transition hover:bg-red-100"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
