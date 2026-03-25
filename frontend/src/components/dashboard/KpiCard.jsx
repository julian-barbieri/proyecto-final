export default function KpiCard({
  titulo,
  valor,
  subtitulo,
  color = "blue",
  icono,
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };

  const iconoColorClasses = {
    blue: "text-blue-500",
    green: "text-green-500",
    amber: "text-amber-500",
    red: "text-red-500",
  };

  return (
    <div
      className={`${colorClasses[color]} border rounded-lg p-6 flex items-start gap-4`}
    >
      {icono && (
        <div className={`${iconoColorClasses[color]} text-3xl flex-shrink-0`}>
          {icono}
        </div>
      )}
      <div className="flex-1">
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          {titulo}
        </p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{valor}</p>
        <p className="text-xs text-gray-600 mt-2">{subtitulo}</p>
      </div>
    </div>
  );
}
