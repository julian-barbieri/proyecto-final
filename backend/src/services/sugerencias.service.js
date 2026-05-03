const { GoogleGenAI } = require('@google/genai');
const db = require('../db/database');
const { calcularVariablesAbandono } = require('./prediction-variables.service');
const { precalcularPrediccionesCompletas } = require('./panel-predicciones.service');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function getNivelRiesgo(prob) {
  if (prob >= 0.7) return 'ALTO';
  if (prob >= 0.5) return 'MEDIO';
  return 'BAJO';
}

function generarPrompt(datos, predicciones, rol) {
  const {
    alumno, materia, vars, cursadaActual,
    vecesCursada, parcialesRendidos, totalParciales,
    historialCursadas, ultimosExamenes,
  } = datos;

  const probAbandono = predicciones?.abandono?.probabilidad ?? null;
  const probRecursado = predicciones?.recursado?.probabilidad ?? null;
  const notaEsperada = predicciones?.nota?.nota ?? null;

  const asistenciaPct = cursadaActual?.asistencia != null
    ? Math.round(cursadaActual.asistencia * 100)
    : Math.round((vars.PromedioAsistencia || 0) * 100);

  const historialTexto = historialCursadas.length > 0
    ? historialCursadas.map((h) => `- ${h.anio}: ${h.materia_nombre} (${h.estado})`).join('\n')
    : 'Sin historial registrado';

  const examenesTexto = ultimosExamenes.length > 0
    ? ultimosExamenes.map((e) => `- ${e.anio} ${e.materia_nombre}: ${e.tipo} → ${e.nota}`).join('\n')
    : 'Sin exámenes registrados';

  const showAbandono = rol === 'admin' || rol === 'coordinador';
  const lineaAbandono = showAbandono
    ? (probAbandono != null
        ? `- Probabilidad de abandono: ${Math.round(probAbandono * 100)}% (riesgo ${getNivelRiesgo(probAbandono)})`
        : '- Probabilidad de abandono: no disponible')
    : '';

  const lineaRecursado = probRecursado != null
    ? `- Probabilidad de recursado: ${Math.round(probRecursado * 100)}% (riesgo ${getNivelRiesgo(probRecursado)})`
    : '- Probabilidad de recursado: no disponible';

  const lineaNota = notaEsperada != null
    ? `- Nota esperada próximo examen: ${Number(notaEsperada).toFixed(1)}`
    : '- Nota esperada: no disponible';

  return `Sos un asistente académico que ayuda a docentes universitarios.
Analizá la siguiente información de un alumno y respondé SOLO con este formato exacto, sin explicaciones adicionales:
**Resumen:** [una oración que describa la situación del alumno]
• [acción concreta 1]
• [acción concreta 2]
• [acción concreta 3 — opcional]
Máximo 80 palabras en total.

--- DATOS DEL ALUMNO ---
Nombre: ${alumno.nombre_completo}
Materia: ${materia.nombre}
Año de ingreso: ${alumno.anio_ingreso ?? 'desconocido'}

PREDICCIONES:
${[lineaAbandono, lineaRecursado, lineaNota].filter(Boolean).join('\n')}

VARIABLES CLAVE:
- Asistencia actual: ${asistenciaPct}%
- Promedio general de notas: ${Number(vars.PromedioNota || 0).toFixed(2)}
- Veces que cursó esta materia: ${vecesCursada}
- Parciales rendidos: ${parcialesRendidos} de ${totalParciales || '?'}

HISTORIAL DE CURSADAS:
${historialTexto}

ÚLTIMOS EXÁMENES:
${examenesTexto}`;
}

function obtenerDatosAlumno(alumnoId, materiaId) {
  const alumno = db
    .prepare(
      `SELECT id, COALESCE(nombre_completo, username) AS nombre_completo,
              anio_ingreso, promedio_colegio
       FROM users WHERE id = ? AND role = 'alumno' LIMIT 1`,
    )
    .get(alumnoId);

  if (!alumno) return null;

  const materia = db
    .prepare('SELECT nombre FROM materias WHERE id = ? LIMIT 1')
    .get(materiaId);

  if (!materia) return null;

  let vars;
  try {
    vars = calcularVariablesAbandono(alumnoId);
  } catch {
    vars = { PromedioAsistencia: 0, PromedioNota: 0, CantRecursa: 0 };
  }

  const cursadaActual = db
    .prepare(
      `SELECT anio, asistencia FROM cursadas
       WHERE alumno_id = ? AND materia_id = ?
       ORDER BY anio DESC LIMIT 1`,
    )
    .get(alumnoId, materiaId);

  const vecesCursada =
    db
      .prepare('SELECT COUNT(*) AS cnt FROM cursadas WHERE alumno_id = ? AND materia_id = ?')
      .get(alumnoId, materiaId)?.cnt ?? 0;

  let parcialesRendidos = 0;
  let totalParciales = 0;
  if (cursadaActual) {
    parcialesRendidos =
      db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM examenes
           WHERE alumno_id = ? AND materia_id = ? AND anio = ? AND tipo = 'Parcial' AND rendido = 1`,
        )
        .get(alumnoId, materiaId, cursadaActual.anio)?.cnt ?? 0;

    totalParciales =
      db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM examenes
           WHERE alumno_id = ? AND materia_id = ? AND anio = ? AND tipo = 'Parcial'`,
        )
        .get(alumnoId, materiaId, cursadaActual.anio)?.cnt ?? 0;
  }

  const historialCursadas = db
    .prepare(
      `SELECT c.anio, c.estado, m.nombre AS materia_nombre
       FROM cursadas c JOIN materias m ON m.id = c.materia_id
       WHERE c.alumno_id = ?
       ORDER BY c.anio DESC
       LIMIT 8`,
    )
    .all(alumnoId);

  const ultimosExamenes = db
    .prepare(
      `SELECT e.tipo, e.nota, e.anio, m.nombre AS materia_nombre
       FROM examenes e JOIN materias m ON m.id = e.materia_id
       WHERE e.alumno_id = ? AND e.rendido = 1 AND e.nota IS NOT NULL
       ORDER BY e.anio DESC
       LIMIT 8`,
    )
    .all(alumnoId);

  return {
    alumno,
    materia,
    vars,
    cursadaActual,
    vecesCursada,
    parcialesRendidos,
    totalParciales,
    historialCursadas,
    ultimosExamenes,
  };
}

function obtenerDatosAlumnoGlobal(alumnoId) {
  const alumno = db
    .prepare(
      `SELECT id, COALESCE(nombre_completo, username) AS nombre_completo,
              anio_ingreso, promedio_colegio, ayuda_financiera, colegio_tecnico
       FROM users WHERE id = ? AND role = 'alumno' LIMIT 1`,
    )
    .get(alumnoId);

  if (!alumno) return null;

  const todasCursadas = db
    .prepare(
      `SELECT c.estado, c.asistencia, c.anio, m.nombre AS materia_nombre
       FROM cursadas c JOIN materias m ON m.id = c.materia_id
       WHERE c.alumno_id = ?
       ORDER BY c.anio DESC`,
    )
    .all(alumnoId);

  const aprobadas = todasCursadas.filter((c) => c.estado === 'aprobada');
  const recursadas = todasCursadas.filter((c) => c.estado === 'recursada');
  const cursando = todasCursadas.filter((c) => c.estado === 'cursando');
  const abandonadas = todasCursadas.filter((c) => c.estado === 'abandonada');

  const examenesConNota = db
    .prepare(
      `SELECT e.nota FROM examenes e
       WHERE e.alumno_id = ? AND e.rendido = 1 AND e.nota IS NOT NULL`,
    )
    .all(alumnoId);

  const promedio_notas =
    examenesConNota.length > 0
      ? examenesConNota.reduce((s, e) => s + Number(e.nota), 0) / examenesConNota.length
      : null;

  const asistencia_promedio =
    todasCursadas.length > 0
      ? todasCursadas.reduce((s, c) => s + Number(c.asistencia || 0), 0) / todasCursadas.length
      : null;

  const historialCursadas = db
    .prepare(
      `SELECT c.estado, c.anio, m.nombre AS materia_nombre
       FROM cursadas c JOIN materias m ON m.id = c.materia_id
       WHERE c.alumno_id = ?
       ORDER BY c.anio DESC
       LIMIT 10`,
    )
    .all(alumnoId);

  const historialTexto =
    historialCursadas.length > 0
      ? historialCursadas.map((c) => `- ${c.anio}: ${c.materia_nombre} (${c.estado})`).join('\n')
      : 'Sin historial registrado';

  return {
    alumno,
    indicadores: {
      total_cursadas: todasCursadas.length,
      aprobadas: aprobadas.length,
      recursadas: recursadas.length,
      cursando: cursando.length,
      abandonadas: abandonadas.length,
      promedio_notas: promedio_notas != null ? Number(promedio_notas.toFixed(2)) : null,
      asistencia_promedio: asistencia_promedio != null
        ? Number(asistencia_promedio.toFixed(4))
        : null,
    },
    materiasEnCurso: cursando.map((c) => ({ nombre: c.materia_nombre })),
    historialTexto,
  };
}

function generarPromptGlobal(datos, predicciones, rol) {
  const { alumno, indicadores, materiasEnCurso, historialTexto } = datos;

  const probAbandono = predicciones?.abandono?.probabilidad ?? null;
  const showAbandono = rol === 'admin' || rol === 'coordinador';

  const lineaAbandono = showAbandono
    ? (probAbandono != null
        ? `- Probabilidad de abandono: ${Math.round(probAbandono * 100)}% (riesgo ${getNivelRiesgo(probAbandono)})`
        : '- Probabilidad de abandono: no disponible')
    : '';

  const materiasEnCursoTexto =
    materiasEnCurso.length > 0
      ? materiasEnCurso.map((m) => `- ${m.nombre}`).join('\n')
      : 'Ninguna';

  const promedioTexto =
    indicadores.promedio_notas != null
      ? indicadores.promedio_notas.toFixed(2)
      : 'no disponible';

  const asistenciaTexto =
    indicadores.asistencia_promedio != null
      ? `${Math.round(indicadores.asistencia_promedio * 100)}%`
      : 'no disponible';

  return `Sos un asistente académico que ayuda a coordinadores universitarios.
Analizá la siguiente información general de un alumno y respondé SOLO con este formato exacto, sin explicaciones adicionales:
**Resumen:** [una oración que describa la situación global del alumno]
• [acción concreta 1]
• [acción concreta 2]
• [acción concreta 3 — opcional]
Máximo 80 palabras en total.

--- DATOS DEL ALUMNO ---
Nombre: ${alumno.nombre_completo}
Año de ingreso: ${alumno.anio_ingreso ?? 'desconocido'}
Promedio colegio: ${alumno.promedio_colegio ?? 'desconocido'}
Ayuda financiera: ${alumno.ayuda_financiera ? 'sí' : 'no'}

INDICADORES GLOBALES:
- Total materias cursadas: ${indicadores.total_cursadas}
- Aprobadas: ${indicadores.aprobadas} | Recursadas: ${indicadores.recursadas} | Abandonadas: ${indicadores.abandonadas} | En curso: ${indicadores.cursando}
- Promedio de notas: ${promedioTexto}
- Asistencia promedio: ${asistenciaTexto}

MATERIAS EN CURSO:
${materiasEnCursoTexto}

PREDICCIONES:
${[lineaAbandono].filter(Boolean).join('\n') || '- Sin predicciones disponibles'}

HISTORIAL (últimas 10 cursadas):
${historialTexto}`;
}

async function callGemini(prompt) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
  });
  return response.text ?? null;
}

async function generarSugerencia(alumnoId, materiaId, rol) {
  if (materiaId == null) { // null or undefined → global mode
    const datos = obtenerDatosAlumnoGlobal(alumnoId);
    if (!datos) return null;

    const prediccionesMap = await precalcularPrediccionesCompletas([alumnoId], null);
    const predicciones = prediccionesMap[alumnoId] || {};
    const prompt = generarPromptGlobal(datos, predicciones, rol);
    return callGemini(prompt);
  }

  const datos = obtenerDatosAlumno(alumnoId, materiaId);
  if (!datos) return null;

  const prediccionesMap = await precalcularPrediccionesCompletas([alumnoId], materiaId);
  const predicciones = prediccionesMap[alumnoId] || {};
  const prompt = generarPrompt(datos, predicciones, rol);
  return callGemini(prompt);
}

module.exports = {
  getNivelRiesgo,
  generarPrompt,
  obtenerDatosAlumno,
  obtenerDatosAlumnoGlobal,
  generarPromptGlobal,
  generarSugerencia,
};
