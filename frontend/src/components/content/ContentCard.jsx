const TYPE_META = {
  pdf: {
    icon: "📄",
    label: "PDF",
    border: "border-red-200",
    badge: "bg-red-50 text-red-700",
  },
  word: {
    icon: "📝",
    label: "Word",
    border: "border-blue-200",
    badge: "bg-blue-50 text-blue-700",
  },
  video: {
    icon: "🎥",
    label: "Video",
    border: "border-purple-200",
    badge: "bg-purple-50 text-purple-700",
  },
  imagen: {
    icon: "🖼",
    label: "Imagen",
    border: "border-green-200",
    badge: "bg-green-50 text-green-700",
  },
  texto: {
    icon: "📃",
    label: "Texto",
    border: "border-slate-200",
    badge: "bg-slate-100 text-slate-700",
  },
};

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function ContentCard({
  item,
  onClick,
  isLoading = false,
  seen = false,
}) {
  const meta = TYPE_META[item?.tipo] || TYPE_META.texto;

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      disabled={isLoading}
      className={`relative flex min-h-[190px] flex-col rounded-lg border bg-white p-4 text-left shadow-sm transition hover:shadow-md disabled:cursor-wait disabled:opacity-80 ${meta.border}`}
    >
      {item?.alumno_id !== null && item?.alumno_id !== undefined ? (
        <span className="absolute right-3 top-3 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
          Para vos
        </span>
      ) : null}

      {seen ? (
        <span className="absolute bottom-3 right-3 text-xs font-medium text-emerald-700">
          ✓ Vista
        </span>
      ) : null}

      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">
          {meta.icon}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}
        >
          {meta.label}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-slate-900">{item?.titulo}</h3>
      <p
        className="mt-2 text-sm text-slate-600"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {item?.descripcion || "Sin descripción"}
      </p>

      <div className="mt-auto pt-4 text-xs text-slate-500">
        <p className="truncate">Tutor: {item?.tutor_nombre || "Tutor"}</p>
        <p>Publicado: {formatDate(item?.created_at)}</p>
      </div>

      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/80">
          <span className="text-sm font-medium text-slate-700">
            Cargando...
          </span>
        </div>
      ) : null}
    </button>
  );
}
