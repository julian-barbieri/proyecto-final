const colorClasses = {
  blue: "border-t-blue-500 text-blue-700",
  red: "border-t-red-500 text-red-700",
  orange: "border-t-orange-500 text-orange-700",
  green: "border-t-emerald-500 text-emerald-700",
};

export default function MetricCard({
  title,
  value,
  subtitle,
  color = "blue",
  icon,
}) {
  const accentClassName = colorClasses[color] || colorClasses.blue;

  return (
    <article
      className={`rounded-2xl border border-slate-200 border-t-4 bg-white p-5 shadow-sm ${accentClassName}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        {icon && (
          <div
            className="rounded-xl bg-slate-50 p-3 text-slate-600"
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>
      <p className="mt-3 text-sm text-slate-500">{subtitle}</p>
    </article>
  );
}
