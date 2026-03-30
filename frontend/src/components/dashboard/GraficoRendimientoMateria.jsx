import { useEffect, useRef } from 'react';

export default function GraficoRendimientoMateria({ materia }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !materia.examenes.length) return;

    // Destruir instancia anterior si existe
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Verificar que Chart.js esté disponible
    if (!window.Chart) {
      console.error('Chart.js no está cargado.');
      return;
    }

    const labels = materia.examenes.map((e) => e.label); // 'Parcial 1', 'Recuperatorio 1', etc.
    const aprobados = materia.examenes.map((e) => e.pct_aprobados);
    const desaprobados = materia.examenes.map((e) => e.pct_desaprobados);
    const ausentes = materia.examenes.map((e) => e.pct_ausentes);

    chartRef.current = new window.Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Aprobados (%)',
            data: aprobados,
            backgroundColor: '#22c55e', // verde
            stack: 'stack',
          },
          {
            label: 'Desaprobados (%)',
            data: desaprobados,
            backgroundColor: '#ef4444', // rojo
            stack: 'stack',
          },
          {
            label: 'Ausentes (%)',
            data: ausentes,
            backgroundColor: '#d1d5db', // gris
            stack: 'stack',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { font: { size: 12 } },
          },
          y: {
            stacked: true,
            min: 0,
            max: 100,
            ticks: {
              callback: (v) => v + '%',
              font: { size: 11 },
            },
            grid: { color: '#f3f4f6' },
          },
        },
        plugins: {
          legend: { display: false }, // leyenda custom en HTML (ver abajo)
          tooltip: {
            callbacks: {
              // Agregar promedio de nota y total rendidos al tooltip
              afterBody: (items) => {
                const idx = items[0].dataIndex;
                const examen = materia.examenes[idx];
                return [
                  `Promedio nota: ${examen.promedio_nota ?? '—'}`,
                  `Total rindieron: ${examen.total_rendidos} / ${examen.total_intentos}`,
                ];
              },
              label: (item) => {
                return ` ${item.dataset.label}: ${item.raw}%`;
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [materia]);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 mb-8">
      {/* Header de la materia */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {materia.materia_codigo}
          </span>
          <h3 className="text-base font-medium text-gray-800 mt-0.5">
            {materia.materia_nombre}
          </h3>
        </div>
        {/* Leyenda custom */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block bg-green-500" />
            Aprobados
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block bg-red-500" />
            Desaprobados
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block bg-gray-300" />
            Ausentes
          </span>
        </div>
      </div>

      {/* Gráfico */}
      <div style={{ position: 'relative', height: '260px' }}>
        <canvas ref={canvasRef} />
      </div>

      {/* Tabla resumen debajo del gráfico */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs text-gray-600">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 px-2 font-medium text-gray-500">
                Examen
              </th>
              <th className="text-center py-2 px-2 font-medium text-gray-500">
                Rindieron
              </th>
              <th className="text-center py-2 px-2 font-medium text-green-600">
                Aprobados
              </th>
              <th className="text-center py-2 px-2 font-medium text-red-500">
                Desaprobados
              </th>
              <th className="text-center py-2 px-2 font-medium text-gray-400">
                Ausentes
              </th>
              <th className="text-center py-2 px-2 font-medium text-gray-500">
                Prom. nota
              </th>
            </tr>
          </thead>
          <tbody>
            {materia.examenes.map((e, i) => (
              <tr
                key={i}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
              >
                <td className="py-2 px-2 font-medium text-gray-700">{e.label}</td>
                <td className="py-2 px-2 text-center text-gray-600">
                  {e.total_rendidos}
                  <span className="text-gray-400 ml-1">/ {e.total_intentos}</span>
                </td>
                <td className="py-2 px-2 text-center">
                  <span
                    className={`font-medium ${
                      e.pct_aprobados >= 50
                        ? 'text-green-600'
                        : 'text-green-400'
                    }`}
                  >
                    {e.pct_aprobados}%
                  </span>
                  <span className="text-gray-400 ml-1">({e.total_aprobados})</span>
                </td>
                <td className="py-2 px-2 text-center">
                  <span
                    className={`font-medium ${
                      e.pct_desaprobados >= 40
                        ? 'text-red-600'
                        : 'text-red-400'
                    }`}
                  >
                    {e.pct_desaprobados}%
                  </span>
                  <span className="text-gray-400 ml-1">
                    ({e.total_desaprobados})
                  </span>
                </td>
                <td className="py-2 px-2 text-center text-gray-400">
                  {e.pct_ausentes}%
                  <span className="ml-1">({e.total_ausentes})</span>
                </td>
                <td className="py-2 px-2 text-center">
                  <span
                    className={`font-medium ${
                      e.promedio_nota >= 6
                        ? 'text-green-600'
                        : e.promedio_nota >= 4
                          ? 'text-amber-500'
                          : 'text-red-500'
                    }`}
                  >
                    {e.promedio_nota > 0 ? e.promedio_nota : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
