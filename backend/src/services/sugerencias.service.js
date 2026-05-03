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

  const lineaAbandono = rol !== 'docente'
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

async function generarSugerencia(alumnoId, materiaId) {
  const datos = obtenerDatosAlumno(alumnoId, materiaId);
  if (!datos) return null;

  const prediccionesMap = await precalcularPrediccionesCompletas([alumnoId], materiaId);
  const predicciones = prediccionesMap[alumnoId] || {};

  const prompt = generarPrompt(datos, predicciones);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
  });

  return response.text ?? null;
}

module.exports = { getNivelRiesgo, generarPrompt, obtenerDatosAlumno, generarSugerencia };
