export function SugerenciaContent({ texto }) {
  const lines = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  const resumenLine = lines.find((l) => l.startsWith('**Resumen:**'));
  const bullets = lines
    .filter((l) => /^[•\-*–◦]/.test(l) && !l.startsWith('**Resumen:**'))
    .map((l) => l.replace(/^[•\-*–◦]\s*/, ''));
  const resumen = resumenLine ? resumenLine.replace(/^\*\*Resumen:\*\*\s*/, '') : null;

  if (bullets.length > 0) {
    return (
      <div className="space-y-3">
        {resumen && (
          <p className="text-sm font-semibold text-slate-800">{resumen}</p>
        )}
        <ul className="space-y-1.5 pl-1">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-0.5 text-blue-500 flex-shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{texto}</p>
  );
}

export default function ModalSugerencia({ alumnoNombre, estado, onClose, onRetry }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 text-lg leading-none"
        >
          ✕
        </button>

        <h2 className="mb-1 text-base font-semibold text-slate-900">
          Sugerencias para {alumnoNombre}
        </h2>
        <p className="mb-4 text-xs text-slate-400">Generado por IA · Solo orientativo</p>

        {estado.status === 'loading' && (
          <div className="flex items-center gap-3 py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent flex-shrink-0" />
            <p className="text-sm text-slate-600">Analizando perfil del alumno...</p>
          </div>
        )}

        {estado.status === 'success' && (
          <SugerenciaContent texto={estado.texto} />
        )}

        {estado.status === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-red-600">{estado.texto}</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
