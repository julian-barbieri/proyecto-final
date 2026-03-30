import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import GraficoEvolucionNotas from "../components/GraficoEvolucionNotas";

function SkeletonLoader() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 animate-pulse">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-gray-300" />
          <div className="flex-1">
            <div className="h-6 bg-gray-300 rounded w-48 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-64 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-80 mb-3" />
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-7 bg-gray-200 rounded-full w-24" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="border-b border-gray-200 h-8 flex gap-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 bg-gray-200 rounded w-32" />
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-200 rounded-xl h-64 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function TarjetaPrediccion({ titulo, icono, disponible, color, children }) {
  const bg = {
    red: "bg-red-50",
    amber: "bg-amber-50",
    green: "bg-green-50",
    gray: "bg-gray-50",
    blue: "bg-blue-50",
  };
  const border = {
    red: "border-red-200",
    amber: "border-amber-200",
    green: "border-green-200",
    gray: "border-gray-200",
    blue: "border-blue-200",
  };
  const text = {
    red: "text-red-700",
    amber: "text-amber-700",
    green: "text-green-700",
    gray: "text-gray-500",
    blue: "text-blue-700",
  };

  return (
    <div className={`${bg[color]} border ${border[color]} rounded-xl p-5`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icono}</span>
        <h3 className={`text-sm font-medium ${text[color]}`}>{titulo}</h3>
      </div>
      <div className={text[color]}>
        {disponible ? (
          children
        ) : (
          <p className="text-sm text-gray-400 mt-3">No disponible</p>
        )}
      </div>
    </div>
  );
}

function AcordeonCursada({ cursada }) {
  const [abierto, setAbierto] = useState(cursada.estado === "cursando");

  const colorEstado = {
    cursando: "bg-blue-100 text-blue-700",
    aprobada: "bg-green-100 text-green-700",
    recursada: "bg-amber-100 text-amber-700",
    abandonada: "bg-red-100 text-red-700",
  };

  return (
    <div className="border border-gray-100 rounded-lg mb-2 overflow-hidden">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            Año {cursada.anio}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              colorEstado[cursada.estado]
            }`}
          >
            {cursada.estado.charAt(0).toUpperCase() + cursada.estado.slice(1)}
          </span>
          <span
            className={`text-xs ${
              cursada.asistencia < 0.75
                ? "text-red-500 font-medium"
                : "text-gray-400"
            }`}
          >
            Asistencia: {(cursada.asistencia * 100).toFixed(0)}%
            {cursada.asistencia < 0.75 && " ⚠"}
          </span>
        </div>
        <span className="text-gray-400 text-sm">{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div className="px-4 pb-4">
          {cursada.examenes.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">
              Sin exámenes registrados.
            </p>
          ) : (
            <table className="w-full text-xs mt-2">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">
                    Examen
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">
                    Rendido
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">
                    Nota
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">
                    Ausente
                  </th>
                </tr>
              </thead>
              <tbody>
                {cursada.examenes.map((exam, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 px-2 text-gray-700">
                      {exam.tipo} {exam.instancia}
                    </td>
                    <td className="py-2 px-2">{exam.rendido ? "✅" : "⏳"}</td>
                    <td className="py-2 px-2">
                      {exam.nota !== null && exam.nota !== undefined
                        ? exam.nota
                        : "—"}
                    </td>
                    <td className="py-2 px-2">{exam.ausente ? "✅" : "❌"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function AlumnoPerfil() {
  const { alumnoId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabActiva, setTabActiva] = useState("perfil"); // 'perfil' | 'academico' | 'predicciones'
  const [notasPredecidas, setNotasPredecidas] = useState([]);
  const [loadingNotas, setLoadingNotas] = useState(false);

  // Estados para edición de campos
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editError, setEditError] = useState(null);
  const [formEdit, setFormEdit] = useState({
    ayuda_financiera: 0,
  });

  // Cargar perfil del alumno
  const cargarPerfil = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(
        `/api/gestion-alumnos/alumnos/${alumnoId}`,
      );
      setData(response.data);
      // Inicializar formulario de edición con datos del alumno
      setFormEdit({
        ayuda_financiera: response.data.alumno.ayuda_financiera ?? 0,
      });
    } catch (err) {
      console.error("Error cargando perfil:", err);
      setError(
        err.response?.data?.error ||
          err.message ||
          "Error al cargar el perfil del alumno",
      );
    } finally {
      setLoading(false);
    }
  };

  // Cargar perfil al montar el componente
  useEffect(() => {
    cargarPerfil();
  }, [alumnoId]);

  // Generar predicciones de notas para materias en curso
  useEffect(() => {
    const calcularVariablesExamenLocal = (cursada, data) => {
      // Calcular valores reales del historial de exámenes
      const examenesCursada = cursada.examenes || [];

      const parcialesRendidos = examenesCursada.filter(
        (e) =>
          e.tipo === "Parcial" &&
          Number(e.rendido) === 1 &&
          e.nota !== null &&
          e.nota !== undefined,
      );

      const notaPromedioParcialCursada =
        parcialesRendidos.length > 0
          ? parcialesRendidos.reduce((sum, e) => sum + Number(e.nota), 0) /
            parcialesRendidos.length
          : 0;

      const cantParcialesAprobados = parcialesRendidos.filter(
        (e) => Number(e.nota) >= 4,
      ).length;

      // Contar cuántas materias tiene cursadas
      const todasCursadas = data.cursadas || [];
      const recursadasMateria = todasCursadas.filter(
        (c) => c.materia_id === cursada.materia_id && c.estado === "recursada",
      ).length;
      const vecesCursadaMateria = todasCursadas.filter(
        (c) => c.materia_id === cursada.materia_id,
      ).length;

      const tasaRecursaMateria =
        vecesCursadaMateria > 0 ? recursadasMateria / vecesCursadaMateria : 0;

      const promedioAsistenciaHistMateria =
        vecesCursadaMateria > 0
          ? todasCursadas
              .filter((c) => c.materia_id === cursada.materia_id)
              .reduce((sum, c) => sum + Number(c.asistencia || 0), 0) /
            vecesCursadaMateria
          : Number(cursada.asistencia || 0.75);

      const recursadasGeneral = todasCursadas.filter(
        (c) => c.estado === "recursada",
      ).length;
      const tasaRecursaGeneral =
        todasCursadas.length > 0 ? recursadasGeneral / todasCursadas.length : 0;

      const promedioAsistenciaGeneral =
        todasCursadas.length > 0
          ? todasCursadas.reduce(
              (sum, c) => sum + Number(c.asistencia || 0),
              0,
            ) / todasCursadas.length
          : 0;

      return {
        notaPromedioParcialCursada,
        cantParcialesAprobados,
        tasaRecursaMateria,
        promedioAsistenciaHistMateria,
        tasaRecursaGeneral,
        promedioAsistenciaGeneral,
      };
    };

    const generarPrediccionesNotas = async () => {
      console.log(`[DEBUG] generarPrediccionesNotas iniciada con data:`, data);

      if (!data?.cursadas) {
        console.log(`[DEBUG] No hay cursadas en data`);
        return;
      }

      console.log(
        `[DEBUG] Total cursadas: ${data.cursadas.length}`,
        data.cursadas.map((c) => ({
          codigo: c.materia_codigo,
          estado: c.estado,
          examenes_count: (c.examenes || []).length,
        })),
      );

      // Mostrar tabla de cursadas para debugging
      console.table(
        data.cursadas.map((c) => ({
          materia: c.materia_codigo,
          estado: c.estado,
          anio: c.anio,
          asistencia: c.asistencia,
          exámenes: (c.examenes || []).length,
        })),
      );

      // Incluir cursadas en "cursando" y cursadas "aprobada" que tengan finales pendientes
      const cursadasActivas = data.cursadas.filter((c) => {
        if (c.estado === "cursando") return true;

        // Para cursadas "aprobada", verificar si hay finales pendientes o desaprobados
        if (c.estado === "aprobada") {
          const examenesCursada = c.examenes || [];
          // Buscar si hay finales pendientes (no rendidos) o desaprobados
          const tieneFinalesPendientes = [1, 2, 3].some((inst) => {
            const finalExam = examenesCursada.find(
              (e) =>
                e.tipo === "Final" && e.instancia === inst && e.rendido === 1,
            );
            // Si el final no existe o fue desaprobado (nota < 4), está pendiente para rendir
            return !finalExam || (finalExam && finalExam.nota < 4);
          });
          return tieneFinalesPendientes;
        }

        return false;
      });

      if (cursadasActivas.length === 0) {
        setNotasPredecidas([]);
        setLoadingNotas(false);
        return;
      }

      setLoadingNotas(true);
      const notas = [];

      for (const cursada of cursadasActivas) {
        try {
          console.log(`[DEBUG] Procesando cursada:`, cursada);

          // Orden del flujo académico: P1 → R1 → P2 → R2 → F1 → F2 → F3
          const flujo = [
            { tipo: "Parcial", inst: 1 },
            { tipo: "Recuperatorio", inst: 1 },
            { tipo: "Parcial", inst: 2 },
            { tipo: "Recuperatorio", inst: 2 },
            { tipo: "Final", inst: 1 },
            { tipo: "Final", inst: 2 },
            { tipo: "Final", inst: 3 },
          ];

          // Para cursadas aprobadas, buscar el próximo final no aprobado
          let proximoExamen;
          if (cursada.estado === "aprobada") {
            // Solo buscar en finales
            const examenActual = cursada.examenes || [];
            proximoExamen = [1, 2, 3]
              .map((inst) => ({ tipo: "Final", inst }))
              .find((f) => {
                const finalExam = examenActual.find(
                  (e) =>
                    e.tipo === f.tipo &&
                    e.instancia === f.inst &&
                    e.rendido === 1,
                );
                // Buscar el primer final no rendido o desaprobado
                return !finalExam || (finalExam && finalExam.nota < 4);
              });
          } else {
            // Para cursadas en "cursando", buscar el primer examen no rendido
            proximoExamen = flujo.find(
              (f) =>
                !(cursada.examenes || []).some(
                  (e) =>
                    e.tipo === f.tipo &&
                    e.instancia === f.inst &&
                    e.rendido === 1,
                ),
            );
          }

          console.log(
            `[DEBUG] Próximo examen para ${cursada.materia_codigo}:`,
            proximoExamen,
          );

          if (proximoExamen) {
            try {
              // Calcular variables reales del historial
              const vars = calcularVariablesExamenLocal(cursada, data);

              // Construir payload con datos correctos
              const payload = {
                Materia: parseInt(cursada.materia_id),
                TipoExamen: proximoExamen.tipo,
                Instancia: parseInt(proximoExamen.inst),
                Anio: parseInt(cursada.anio),
                Asistencia: parseFloat(cursada.asistencia || 0.75),
                VecesRecursada: parseInt(cursada.veces_recursada || 0),
                Genero: data.alumno.genero === "M" ? 1 : 0,
                Edad: parseInt(data.alumno.edad || 20),
                AyudaFinanciera: parseInt(data.alumno.ayuda_financiera || 0),
                ColegioTecnico: parseInt(data.alumno.colegio_tecnico || 0),
                PromedioColegio: parseFloat(data.alumno.promedio_colegio || 7),
                AniosDesdeIngreso:
                  new Date().getFullYear() -
                  parseInt(data.alumno.anio_ingreso || 2020),
                VecesCursadaMateria: data.cursadas.filter(
                  (c) => c.materia_id === cursada.materia_id,
                ).length,
                TasaRecursaMateria: parseFloat(vars.tasaRecursaMateria),
                PromedioAsistenciaHistMateria: parseFloat(
                  vars.promedioAsistenciaHistMateria,
                ),
                TotalCursadasGeneral: data.cursadas.length,
                TasaRecursaGeneral: parseFloat(vars.tasaRecursaGeneral),
                PromedioAsistenciaGeneral: parseFloat(
                  vars.promedioAsistenciaGeneral,
                ),
                PosicionFlujo:
                  proximoExamen.tipo === "Parcial"
                    ? proximoExamen.inst
                    : proximoExamen.tipo === "Recuperatorio"
                      ? proximoExamen.inst + 2
                      : proximoExamen.inst + 4,
                AsistenciaBajaRiesgo:
                  (cursada.asistencia || 0.75) < 0.75 ? 1 : 0,
                NotaPromedioParcialCursada: parseFloat(
                  vars.notaPromedioParcialCursada,
                ),
                CantParcialesAprobados: parseInt(vars.cantParcialesAprobados),
                EsUltimaInstancia: 0,
                TieneFinalAM1: cursada.materia_codigo === "AM1" ? 1 : 0,
              };

              console.log(`[DEBUG] Payload para predicción:`, payload);

              // Llamar al endpoint de predicción de examen
              const response = await api.post("/api/predict/examen", [payload]);

              console.log(
                `[DEBUG] Respuesta predicción ${cursada.materia_codigo}:`,
                response.data,
              );

              if (response.data && response.data[0]) {
                const nota = response.data[0];
                notas.push({
                  nota_predicha: nota.Nota || nota.nota_predicha,
                  aprobaria: (nota.Nota || nota.nota_predicha) >= 4,
                  tipo_examen: proximoExamen.tipo,
                  instancia: proximoExamen.inst,
                  materia: cursada.materia_codigo,
                  materia_nombre: cursada.materia_nombre,
                  anio: cursada.anio,
                });
              }
            } catch (errPredict) {
              console.error(
                `[ERROR] Prediciendo nota para ${cursada.materia_codigo}:`,
                errPredict,
              );
            }
          }
        } catch (errMat) {
          console.error(
            `[ERROR] Procesando ${cursada.materia_codigo}:`,
            errMat,
          );
        }
      }

      // ═════════════════════════════════════════════════════════════════════
      // Generar predicciones de RECURSADO para materias elegibles
      // ═════════════════════════════════════════════════════════════════════
      // Caso 1: Materias en estado "cursando"
      // Caso 2: Materias "aprobada" con finales pendientes Y cursando correlativa

      console.log(`[DEBUG] Iniciando búsqueda de materias para recursado...`);

      // Mapa de correlativas: AM1 → AM2
      const correlativas = {
        1: 2, // AM1 (id 1) → AM2 (id 2)
      };

      // CASO 1: Materias en estado "cursando" - generar predicción de recursado
      const materiasEnCurso = data.cursadas.filter(
        (c) => c.estado === "cursando",
      );
      console.log(
        `[DEBUG] Materias en cursando: ${materiasEnCurso.length}`,
        materiasEnCurso.map((c) => c.materia_codigo),
      );

      for (const cursada of materiasEnCurso) {
        console.log(
          `[DEBUG] Generando recursado para ${cursada.materia_codigo} (estado: cursando)`,
        );

        try {
          // Calcular estadísticas de la materia
          const todasCursadas = data.cursadas || [];
          const materiasIndividuo = todasCursadas.filter(
            (c) => c.materia_id === cursada.materia_id,
          );
          const notasMateria =
            cursada.examenes
              ?.filter((e) => e.rendido === 1 && e.nota !== null)
              .map((e) => Number(e.nota)) || [];
          const promedioNotaMateria =
            notasMateria.length > 0
              ? notasMateria.reduce((a, b) => a + b, 0) / notasMateria.length
              : 0;

          const examenesRendidos =
            cursada.examenes?.filter((e) => e.rendido === 1).length || 0;
          const examenesAprobados = notasMateria.filter((n) => n >= 4).length;
          const tasaAprobacionMateria =
            examenesRendidos > 0 ? examenesAprobados / examenesRendidos : 0;

          // Calcular promedio general
          const notasGeneral = todasCursadas
            .flatMap((c) => c.examenes || [])
            .filter((e) => e.rendido === 1 && e.nota !== null)
            .map((e) => Number(e.nota));
          const promedioNotaGeneral =
            notasGeneral.length > 0
              ? notasGeneral.reduce((a, b) => a + b, 0) / notasGeneral.length
              : 0;

          const examenesGeneralAprobados = notasGeneral.filter(
            (n) => n >= 4,
          ).length;
          const tasaAprobacionGeneral =
            notasGeneral.length > 0
              ? examenesGeneralAprobados / notasGeneral.length
              : 0;

          // Construir payload
          const payloadRecursado = {
            Materia: parseInt(cursada.materia_id),
            AnioCursada: parseInt(cursada.anio),
            Asistencia: parseFloat(cursada.asistencia || 0.75),
            Genero: data.alumno.genero === "M" ? 1 : 0,
            Edad: parseInt(data.alumno.edad || 20),
            AyudaFinanciera: parseInt(data.alumno.ayuda_financiera || 0),
            ColegioTecnico: parseInt(data.alumno.colegio_tecnico || 0),
            PromedioColegio: parseFloat(data.alumno.promedio_colegio || 7),
            AnioCursada: parseInt(cursada.anio),
            AniosDesdeIngreso:
              new Date().getFullYear() -
              parseInt(data.alumno.anio_ingreso || 2020),
            VecesRendidaExamenMateria: parseInt(examenesRendidos),
            VecesAusenteMateria: 0,
            PromedioNotaMateria: parseFloat(promedioNotaMateria),
            TasaAprobacionMateria: parseFloat(tasaAprobacionMateria),
            PromedioNotaGeneral: parseFloat(promedioNotaGeneral),
            TasaAprobacionGeneral: parseFloat(tasaAprobacionGeneral),
          };

          console.log(
            `[DEBUG] Payload recursado ${cursada.materia_codigo}:`,
            payloadRecursado,
          );

          const responseRecursado = await api.post("/api/predict/materia", [
            payloadRecursado,
          ]);

          console.log(
            `[DEBUG] Respuesta recursado ${cursada.materia_codigo}:`,
            responseRecursado.data,
          );

          if (
            responseRecursado.data &&
            responseRecursado.data[0] !== undefined
          ) {
            const probabilidadRecursado = responseRecursado.data[0];
            const probValue =
              probabilidadRecursado?.probabilidad ||
              probabilidadRecursado?.Probabilidad ||
              Number(probabilidadRecursado) ||
              0;

            notas.push({
              nota_predicha: probValue,
              aprobaria: false,
              tipo_examen: "Recursado",
              instancia: "Predicción",
              materia: cursada.materia_codigo,
              materia_nombre: cursada.materia_nombre,
              anio: cursada.anio,
              es_prediccion_recursado: true,
            });
          }
        } catch (errRecursado) {
          console.error(
            `[ERROR] Prediciendo recursado para ${cursada.materia_codigo}:`,
            errRecursado,
          );
        }
      }

      // CASO 2: Materias aprobadas con finales pendientes Y cursando correlativa
      const materiasConFinalPendiente = data.cursadas.filter((c) => {
        if (c.estado !== "aprobada") return false;

        const examenesCursada = c.examenes || [];

        // Verificar si hay finales pendientes o desaprobados
        const tieneFinalesPendientes = [1, 2, 3].some((inst) => {
          const finalExam = examenesCursada.find(
            (e) =>
              e.tipo === "Final" && e.instancia === inst && e.rendido === 1,
          );
          return !finalExam || (finalExam && finalExam.nota < 4);
        });

        return tieneFinalesPendientes;
      });

      console.log(
        `[DEBUG] Materias con final pendiente: ${materiasConFinalPendiente.length}`,
        materiasConFinalPendiente.map((c) => c.materia_codigo),
      );

      // Para cada materia con final pendiente, verificar si está cursando correlativa
      for (const materiaConFinal of materiasConFinalPendiente) {
        const correlativaId = correlativas[materiaConFinal.materia_id];

        if (correlativaId) {
          // Verificar si está cursando la correlativa
          const estaCursandoCorrelativa = data.cursadas.some(
            (c) => c.materia_id === correlativaId && c.estado === "cursando",
          );

          if (estaCursandoCorrelativa) {
            console.log(
              `[DEBUG] Generando recursado para ${materiaConFinal.materia_codigo} (aprobada con final pendiente, cursando correlativa)`,
            );

            try {
              // Calcular estadísticas de la materia con final pendiente
              const todasCursadas = data.cursadas || [];
              const materiasIndividuo = todasCursadas.filter(
                (c) => c.materia_id === materiaConFinal.materia_id,
              );
              const notasMateria =
                materiaConFinal.examenes
                  ?.filter((e) => e.rendido === 1 && e.nota !== null)
                  .map((e) => Number(e.nota)) || [];
              const promedioNotaMateria =
                notasMateria.length > 0
                  ? notasMateria.reduce((a, b) => a + b, 0) /
                    notasMateria.length
                  : 0;

              const examenesRendidos =
                materiaConFinal.examenes?.filter((e) => e.rendido === 1)
                  .length || 0;
              const examenesAprobados = notasMateria.filter(
                (n) => n >= 4,
              ).length;
              const tasaAprobacionMateria =
                examenesRendidos > 0 ? examenesAprobados / examenesRendidos : 0;

              // Calcular promedio general
              const notasGeneral = todasCursadas
                .flatMap((c) => c.examenes || [])
                .filter((e) => e.rendido === 1 && e.nota !== null)
                .map((e) => Number(e.nota));
              const promedioNotaGeneral =
                notasGeneral.length > 0
                  ? notasGeneral.reduce((a, b) => a + b, 0) /
                    notasGeneral.length
                  : 0;

              const examenesGeneralAprobados = notasGeneral.filter(
                (n) => n >= 4,
              ).length;
              const tasaAprobacionGeneral =
                notasGeneral.length > 0
                  ? examenesGeneralAprobados / notasGeneral.length
                  : 0;

              // Construir payload de predicción de recursado
              const payloadRecursado = {
                Materia: parseInt(materiaConFinal.materia_id),
                AnioCursada: parseInt(materiaConFinal.anio),
                Asistencia: parseFloat(materiaConFinal.asistencia || 0.75),
                Genero: data.alumno.genero === "M" ? 1 : 0,
                Edad: parseInt(data.alumno.edad || 20),
                AyudaFinanciera: parseInt(data.alumno.ayuda_financiera || 0),
                ColegioTecnico: parseInt(data.alumno.colegio_tecnico || 0),
                PromedioColegio: parseFloat(data.alumno.promedio_colegio || 7),
                AniosDesdeIngreso:
                  new Date().getFullYear() -
                  parseInt(data.alumno.anio_ingreso || 2020),
                VecesRendidaExamenMateria: parseInt(examenesRendidos),
                VecesAusenteMateria: 0,
                PromedioNotaMateria: parseFloat(promedioNotaMateria),
                TasaAprobacionMateria: parseFloat(tasaAprobacionMateria),
                PromedioNotaGeneral: parseFloat(promedioNotaGeneral),
                TasaAprobacionGeneral: parseFloat(tasaAprobacionGeneral),
              };

              console.log(
                `[DEBUG] Payload recursado para ${materiaConFinal.materia_codigo}:`,
                payloadRecursado,
              );

              // Llamar al endpoint de predicción de materia (recursado)
              const responseRecursado = await api.post("/api/predict/materia", [
                payloadRecursado,
              ]);

              console.log(
                `[DEBUG] Respuesta recursado ${materiaConFinal.materia_codigo}:`,
                responseRecursado.data,
              );

              if (
                responseRecursado.data &&
                responseRecursado.data[0] !== undefined
              ) {
                const probabilidadRecursado = responseRecursado.data[0];
                // El backend devuelve: { probabilidad: 0.xxx, recursa: bool, risk: {...} }
                const probValue =
                  probabilidadRecursado?.probabilidad ||
                  probabilidadRecursado?.Probabilidad ||
                  Number(probabilidadRecursado) ||
                  0;

                console.log(
                  `[DEBUG] Probabilidad extraída para ${materiaConFinal.materia_codigo}:`,
                  probValue,
                  "from object:",
                  probabilidadRecursado,
                );

                notas.push({
                  // Usar un ID especial para predicciones de recursado
                  nota_predicha: probValue,
                  aprobaria: false, // Es probabilidad, no nota
                  tipo_examen: "Recursado",
                  instancia: "Predicción",
                  materia: materiaConFinal.materia_codigo,
                  materia_nombre: materiaConFinal.materia_nombre,
                  anio: materiaConFinal.anio,
                  es_prediccion_recursado: true,
                });
              }
            } catch (errRecursado) {
              console.error(
                `[ERROR] Prediciendo recursado para ${materiaConFinal.materia_codigo}:`,
                errRecursado,
              );
            }
          }
        }
      }

      console.log(`[DEBUG] Notas predichas finales:`, notas);
      setNotasPredecidas(notas);
      setLoadingNotas(false);
    };

    if (tabActiva === "predicciones" && data) {
      generarPrediccionesNotas();
    }
  }, [tabActiva, data, alumnoId]);

  // Función para guardar ediciones
  async function guardarEdicion() {
    setGuardando(true);
    setEditError(null);
    try {
      const id = parseInt(alumnoId);
      await api.patch(`/api/gestion-alumnos/alumnos/${id}`, formEdit);

      // Recargar el perfil para obtener las predicciones actualizadas
      await cargarPerfil();

      setEditando(false);
    } catch (err) {
      setEditError(
        err.response?.data?.error || "Error al guardar los cambios.",
      );
    } finally {
      setGuardando(false);
    }
  }

  if (!user || !["admin", "coordinador"].includes(user.role)) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">
          No autorizado. Esta página es solo para admin y coordinadores.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg">
        <SkeletonLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          ← Volver
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          <p className="font-medium">Error al cargar el perfil</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6">Sin datos disponibles</div>;
  }

  const {
    alumno,
    indicadores,
    cursadas = [],
    predicciones = {
      abandono: null,
      recursado: null,
      proxima_nota: null,
      proximas_notas: [],
      error: null,
    },
    historial_predicciones = [],
  } = data || {};

  // Iniciales para avatar
  const iniciales = alumno.nombre_completo
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="p-6 bg-white rounded-lg">
      {/* Botón volver */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        ← Volver
      </button>

      {/* Header del perfil */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-medium flex-shrink-0">
            {iniciales}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-medium text-gray-900">
              {alumno.nombre_completo}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{alumno.email}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {alumno.genero} · {alumno.edad} años · Ingresó en{" "}
              {alumno.anio_ingreso}
            </p>

            {/* Chips de estado rápido */}
            <div className="flex flex-wrap gap-2 mt-3">
              {/* Semáforo de riesgo */}
              {predicciones.abandono && (
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    predicciones.abandono.nivel_riesgo === "alto"
                      ? "bg-red-100 text-red-700"
                      : predicciones.abandono.nivel_riesgo === "medio"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                  }`}
                >
                  {predicciones.abandono.nivel_riesgo === "alto"
                    ? "🔴"
                    : predicciones.abandono.nivel_riesgo === "medio"
                      ? "🟡"
                      : "🟢"}{" "}
                  Riesgo {predicciones.abandono.nivel_riesgo} de abandono
                </span>
              )}

              {/* Estado cursada activa */}
              {cursadas
                .filter((c) => c.estado === "cursando")
                .map((c) => (
                  <span
                    key={c.materia_id}
                    className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium"
                  >
                    📚 Cursando {c.materia_codigo} {c.anio}
                  </span>
                ))}

              {/* Promedio global */}
              {indicadores.promedio_nota_global !== null && (
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    indicadores.promedio_nota_global >= 6
                      ? "bg-green-100 text-green-700"
                      : indicadores.promedio_nota_global >= 4
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  📊 Promedio {indicadores.promedio_nota_global}
                </span>
              )}

              {/* Ayuda financiera */}
              {alumno.ayuda_financiera === 1 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">
                  💰 Ayuda financiera
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-8">
          {[
            { key: "perfil", label: "Información personal" },
            { key: "academico", label: "Historia académica" },
            { key: "predicciones", label: "Predicciones" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTabActiva(tab.key)}
              className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                tabActiva === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido según tab */}
      {tabActiva === "perfil" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Datos personales */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
              Datos personales
            </h2>
            <dl className="space-y-3">
              {[
                {
                  label: "Nombre completo",
                  valor: alumno.nombre_completo,
                },
                { label: "Email", valor: alumno.email },
                { label: "Género", valor: alumno.genero || "—" },
                {
                  label: "Fecha de nacimiento",
                  valor: alumno.fecha_nac || "—",
                },
                {
                  label: "Edad",
                  valor: alumno.edad ? `${alumno.edad} años` : "—",
                },
              ].map(({ label, valor }) => (
                <div key={label} className="flex justify-between items-start">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium text-gray-900 text-right max-w-[60%]">
                    {valor}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Datos académicos de ingreso */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Perfil académico
              </h2>
              {!editando ? (
                <button
                  onClick={() => setEditando(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  ✏ Editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditando(false);
                      setEditError(null);
                    }}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarEdicion}
                    disabled={guardando}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {guardando ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              )}
            </div>

            {editError && (
              <p className="text-xs text-red-600 mb-3 bg-red-50 px-3 py-2 rounded">
                {editError}
              </p>
            )}

            <dl className="space-y-3">
              {/* Campos de solo lectura */}
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Año de ingreso</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {data.alumno.anio_ingreso || "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Promedio en colegio</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {data.alumno.promedio_colegio
                    ? `${data.alumno.promedio_colegio} / 10`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Colegio técnico</dt>
                <dd className="text-sm font-medium">
                  {data.alumno.colegio_tecnico === 1 ? "✅ Sí" : "❌ No"}
                </dd>
              </div>

              {/* Campos editables */}
              <div className="flex justify-between items-center">
                <dt className="text-sm text-gray-500">Ayuda financiera</dt>
                <dd>
                  {editando ? (
                    <select
                      value={formEdit.ayuda_financiera}
                      onChange={(e) =>
                        setFormEdit((f) => ({
                          ...f,
                          ayuda_financiera: parseInt(e.target.value),
                        }))
                      }
                      className="text-sm border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      <option value={0}>No</option>
                      <option value={1}>Sí</option>
                    </select>
                  ) : (
                    <span className="text-sm font-medium">
                      {data.alumno.ayuda_financiera === 1 ? "✅ Sí" : "❌ No"}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Indicadores clave (fila de 4 tarjetas) */}
          <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Materias cursadas",
                valor: indicadores.cant_materias_cursadas,
                sub: `${indicadores.cant_recursadas} recursadas`,
                color: "blue",
                pct: null,
              },
              {
                label: "Tasa de recursado",
                valor: `${(indicadores.tasa_recursado * 100).toFixed(0)}%`,
                sub:
                  indicadores.cant_recursadas > 0
                    ? `${indicadores.cant_recursadas} vez/veces`
                    : "Nunca recursó",
                color:
                  indicadores.tasa_recursado > 0.5
                    ? "red"
                    : indicadores.tasa_recursado > 0
                      ? "amber"
                      : "green",
                pct: indicadores.tasa_recursado * 100,
              },
              {
                label: "Asistencia promedio",
                valor: `${(indicadores.promedio_asistencia * 100).toFixed(0)}%`,
                sub:
                  indicadores.promedio_asistencia < 0.75
                    ? "⚠ Por debajo del mínimo"
                    : "Por encima del mínimo",
                color:
                  indicadores.promedio_asistencia >= 0.8
                    ? "green"
                    : indicadores.promedio_asistencia >= 0.75
                      ? "amber"
                      : "red",
                pct: indicadores.promedio_asistencia * 100,
              },
              {
                label: "Tasa de aprobación",
                valor: `${(indicadores.tasa_aprobacion * 100).toFixed(0)}%`,
                sub: `${indicadores.cant_aprobados} de ${indicadores.cant_examenes_rendidos} exámenes`,
                color:
                  indicadores.tasa_aprobacion >= 0.6
                    ? "green"
                    : indicadores.tasa_aprobacion >= 0.4
                      ? "amber"
                      : "red",
                pct: indicadores.tasa_aprobacion * 100,
              },
            ].map(({ label, valor, sub, color, pct }) => {
              const bg = {
                red: "bg-red-50",
                amber: "bg-amber-50",
                green: "bg-green-50",
                blue: "bg-blue-50",
              };
              const text = {
                red: "text-red-700",
                amber: "text-amber-700",
                green: "text-green-700",
                blue: "text-blue-700",
              };
              const bar = {
                red: "bg-red-400",
                amber: "bg-amber-400",
                green: "bg-green-500",
                blue: "bg-blue-500",
              };
              return (
                <div key={label} className={`${bg[color]} rounded-xl p-4`}>
                  <p className={`text-2xl font-medium ${text[color]}`}>
                    {valor}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                  {pct !== null && (
                    <div className="w-full bg-white/60 rounded-full h-1.5 mt-2">
                      <div
                        className={`${bar[color]} h-1.5 rounded-full transition-all`}
                        style={{
                          width: `${Math.min(pct, 100).toFixed(0)}%`,
                        }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{sub}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tabActiva === "academico" && (
        <div className="space-y-4">
          {["AM1", "AM2"].map((codigo) => {
            const cursadasMateria = cursadas.filter(
              (c) => c.materia_codigo === codigo,
            );
            if (cursadasMateria.length === 0) return null;
            return (
              <div
                key={codigo}
                className="bg-white border border-gray-100 rounded-xl p-5"
              >
                <h3 className="text-base font-medium text-gray-800 mb-4">
                  {codigo} — {cursadasMateria[0].materia_nombre}
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    ({cursadasMateria.length} cursada/s)
                  </span>
                </h3>
                {cursadasMateria.map((cursada) => (
                  <AcordeonCursada key={cursada.anio} cursada={cursada} />
                ))}
              </div>
            );
          })}
          <GraficoEvolucionNotas cursadas={data.cursadas} />
        </div>
      )}

      {tabActiva === "predicciones" && (
        <div className="space-y-6">
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PREDICCIÓN PRINCIPAL: ABANDONO */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {predicciones?.abandono && (
            <div className="bg-white border border-gray-100 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Indicador de Riesgo General
              </h2>
              <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-100/50 p-4">
                {predicciones.abandono.probabilidad !== null &&
                predicciones.abandono.probabilidad !== undefined ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-3xl font-bold text-slate-900">
                        {Math.round(predicciones.abandono.probabilidad * 100)}%
                      </p>
                      <p className="text-base font-semibold text-slate-700">
                        Riesgo de Abandono
                      </p>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          predicciones.abandono.probabilidad > 0.7
                            ? "bg-red-500"
                            : predicciones.abandono.probabilidad > 0.5
                              ? "bg-amber-500"
                              : "bg-green-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            predicciones.abandono.probabilidad * 100,
                            100,
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-sm text-slate-600 font-medium">
                      Nivel:{" "}
                      <span className="capitalize font-semibold text-base">
                        {predicciones.abandono.nivel_riesgo === "alto"
                          ? "🔴 Alto"
                          : predicciones.abandono.nivel_riesgo === "medio"
                            ? "🟡 Medio"
                            : "🟢 Bajo"}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 italic py-3">
                    No disponible
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PREDICCIONES POR MATERIA */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {notasPredecidas && notasPredecidas.length > 0 ? (
            (() => {
              // Agrupar predicciones por materia
              const prediccionesPorMateria = {};
              notasPredecidas.forEach((nota) => {
                if (!prediccionesPorMateria[nota.materia]) {
                  prediccionesPorMateria[nota.materia] = {
                    nombre: nota.materia_nombre || nota.materia,
                    recursado: null,
                    notas: [],
                  };
                }
                if (nota.es_prediccion_recursado) {
                  prediccionesPorMateria[nota.materia].recursado = nota;
                } else {
                  prediccionesPorMateria[nota.materia].notas.push(nota);
                }
              });

              return (
                <div className="space-y-6">
                  {Object.entries(prediccionesPorMateria).map(
                    ([codigoMateria, datos]) => (
                      <div
                        key={codigoMateria}
                        className="bg-white border border-gray-100 rounded-xl p-6"
                      >
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">
                          {codigoMateria} — {datos.nombre}
                        </h2>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {/* RECURSADO - Lado izquierdo */}
                          {datos.recursado ? (
                            <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-100/50 p-4 hover:shadow-sm transition-shadow">
                              {datos.recursado.nota_predicha !== null &&
                              datos.recursado.nota_predicha !== undefined ? (
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-2xl font-bold text-slate-900">
                                      {Math.round(
                                        datos.recursado.nota_predicha * 100,
                                      )}
                                      %
                                    </p>
                                    <p className="text-sm font-semibold text-slate-700">
                                      Riesgo de recursado
                                    </p>
                                  </div>
                                  <p className="text-xs text-slate-600">
                                    Final pendiente
                                  </p>
                                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                    <div
                                      className={`h-2 rounded-full transition-all ${
                                        datos.recursado.nota_predicha > 0.7
                                          ? "bg-red-500"
                                          : datos.recursado.nota_predicha > 0.5
                                            ? "bg-amber-500"
                                            : "bg-green-500"
                                      }`}
                                      style={{
                                        width: `${Math.min(
                                          datos.recursado.nota_predicha * 100,
                                          100,
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                  <p className="text-xs text-slate-600 font-medium">
                                    {datos.recursado.nota_predicha > 0.6
                                      ? "⚠️ Alto riesgo"
                                      : datos.recursado.nota_predicha > 0.4
                                        ? "⚠️ Riesgo medio"
                                        : "✅ Bajo riesgo"}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-600 italic py-3">
                                  No disponible
                                </p>
                              )}
                            </div>
                          ) : (
                            <div />
                          )}

                          {/* PRÓXIMA NOTA - Lado derecho */}
                          <div className="space-y-3">
                            {datos.notas.length > 0 ? (
                              datos.notas.map((nota, idx) => (
                                <div
                                  key={idx}
                                  className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-100/50 p-4 hover:shadow-sm transition-shadow"
                                >
                                  {nota.nota_predicha !== null &&
                                  nota.nota_predicha !== undefined ? (
                                    <div className="space-y-2">
                                      <div>
                                        <p className="text-2xl font-bold text-slate-900">
                                          {nota.nota_predicha.toFixed(1)}
                                        </p>
                                        <p className="text-sm font-semibold text-slate-700">
                                          Próxima nota
                                        </p>
                                      </div>
                                      <p className="text-xs text-slate-600">
                                        {nota.tipo_examen} {nota.instancia} ·
                                        Año {nota.anio}
                                      </p>
                                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                        <div
                                          className={`h-2 rounded-full transition-all ${
                                            nota.nota_predicha >= 8
                                              ? "bg-green-500"
                                              : nota.nota_predicha >= 6
                                                ? "bg-blue-500"
                                                : nota.nota_predicha >= 4
                                                  ? "bg-amber-500"
                                                  : "bg-red-500"
                                          }`}
                                          style={{
                                            width: `${Math.min(
                                              (nota.nota_predicha / 10) * 100,
                                              100,
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                      <p className="text-xs text-slate-600 font-medium">
                                        {nota.aprobaria
                                          ? "✅ Aprobaría"
                                          : "❌ Desaprobaría"}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-600 italic py-3">
                                      No disponible
                                    </p>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div />
                            )}
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              );
            })()
          ) : loadingNotas ? (
            <div className="bg-white border border-gray-100 rounded-xl p-6 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full mb-2"></div>
                <p className="text-sm text-slate-600">
                  Generando predicciones...
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl p-6 text-center">
              <p className="text-sm text-slate-600">
                El alumno no tiene materias en curso con exámenes pendientes
                para predecir.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
