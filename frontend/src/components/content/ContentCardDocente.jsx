import ContentCard from "./ContentCard";

export default function ContentCardDocente({
  item,
  onOpen,
  onDelete,
  deleting = false,
  loading = false,
}) {
  const subidoPor = item.es_propio
    ? "Subido por: vos"
    : item.subido_por_rol === "coordinador"
      ? "Subido por: tutor"
      : `Subido por: ${item.subido_por_nombre || "usuario"}`;

  const paraLabel =
    item.alumno_id === null || item.alumno_id === undefined
      ? "Para: Todo el curso"
      : `Para: ${item.alumno_destinatario_nombre || "Alumno"}`;

  return (
    <div className="relative">
      <ContentCard item={item} onClick={onOpen} isLoading={loading} />

      <div className="pointer-events-none absolute inset-x-4 bottom-14 space-y-1 rounded bg-white/95 p-2 text-xs shadow-sm">
        <p
          className={`font-medium ${
            item.es_propio ? "text-blue-700" : "text-slate-600"
          }`}
        >
          {subidoPor}
        </p>
        <p className="text-slate-600">
          {item.alumno_id !== null && item.alumno_id !== undefined ? "👤 " : ""}
          {paraLabel}
        </p>
      </div>

      {item.es_propio ? (
        <button
          type="button"
          disabled={deleting}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(item);
          }}
          className="absolute bottom-3 right-3 z-10 rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {deleting ? "..." : "🗑"}
        </button>
      ) : null}
    </div>
  );
}
