const db = require("../db/database");

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round4(value) {
  return Number(toNumber(value, 0).toFixed(4));
}

function getYearFromFecha(fecha) {
  if (!fecha || typeof fecha !== "string") return null;
  const value = fecha.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number(value.slice(0, 4));
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return Number(value.slice(6, 10));
  return null;
}

function parseGenero(genero) {
  return String(genero || "").trim().toLowerCase() === "masculino" ? 1 : 0;
}

function getAlumnoByLegajo(legajo) {
  const alumno = db
    .prepare(
      `SELECT id, username, COALESCE(nombre_completo, username) AS nombre_completo,
              email, promedio_colegio, anio_ingreso, genero, fecha_nac,
              ayuda_financiera, colegio_tecnico
       FROM users WHERE id = ? AND role = 'alumno' LIMIT 1`,
    )
    .get(legajo);
  if (!alumno) throw new Error(`Alumno con legajo ${legajo} no encontrado.`);
  return alumno;
}

function getMateria(materiaId) {
  const m = db
    .prepare(
      `SELECT id, codigo, nombre, codigo_plan, tipo,
              anio_carrera, COALESCE(correlativas, '[]') AS correlativas
       FROM materias WHERE id = ? LIMIT 1`,
    )
    .get(materiaId);
  if (!m) throw new Error(`Materia ${materiaId} no encontrada.`);
  return { ...m, correlativas: JSON.parse(m.correlativas) };
}

// Devuelve el conjunto de codigo_plan aprobados por el alumno
function getAprobadas(alumnoId) {
  return new Set(
    db
      .prepare(
        `SELECT m.codigo_plan FROM cursadas c
         JOIN materias m ON c.materia_id = m.id
         WHERE c.alumno_id = ? AND c.estado = 'aprobada' AND m.codigo_plan IS NOT NULL`,
      )
      .all(alumnoId)
      .map((r) => r.codigo_plan),
  );
}

function calcularIndiceBloqueo(aprobadas, correlativas) {
  if (!correlativas || correlativas.length === 0) return 0;
  const noAprobadas = correlativas.filter((c) => !aprobadas.has(c)).length;
  return round4(noAprobadas / correlativas.length);
}

function calcularNotaPromedioCorrelativas(alumnoId, correlativas) {
  if (!correlativas || correlativas.length === 0) return 0;
  const placeholders = correlativas.map(() => "?").join(",");
  const row = db
    .prepare(
      `SELECT AVG(e.nota) AS avg_nota
       FROM examenes e
       JOIN materias m ON e.materia_id = m.id
       WHERE e.alumno_id = ?
         AND m.codigo_plan IN (${placeholders})
         AND e.tipo = 'Final' AND e.rendido = 1 AND e.nota >= 4`,
    )
    .get(alumnoId, ...correlativas);
  return round4(row?.avg_nota || 0);
}

// ──────────────────────────────────────────────────────────────────────────────
// ABANDONO — features del modelo alumno (15 features)
// ──────────────────────────────────────────────────────────────────────────────
function calcularVariablesAbandono(legajo) {
  const alumno = getAlumnoByLegajo(legajo);

  const anioIngreso = Number(alumno.anio_ingreso || new Date().getFullYear());
  const anioNac = getYearFromFecha(alumno.fecha_nac) || 2000;

  const cursadasAlumno = db
    .prepare(
      `SELECT c.id, c.anio, c.asistencia, c.estado FROM cursadas c WHERE c.alumno_id = ?`,
    )
    .all(legajo);

  const cantMaterias = cursadasAlumno.length;
  const promedioAsistencia =
    cantMaterias > 0
      ? cursadasAlumno.reduce((s, c) => s + toNumber(c.asistencia, 0), 0) /
        cantMaterias
      : 0;
  const cantAniosCursados = new Set(cursadasAlumno.map((c) => Number(c.anio)))
    .size;

  const examenesTodos = db
    .prepare(`SELECT id, tipo, rendido, nota, ausente FROM examenes WHERE alumno_id = ?`)
    .all(legajo);

  const cantExamenesRendidos = examenesTodos.filter(
    (e) => Number(e.rendido) === 1,
  ).length;
  const examenesConNota = examenesTodos.filter(
    (e) => Number(e.rendido) === 1 && e.nota !== null && e.nota !== undefined,
  );
  const promedioNota =
    examenesConNota.length > 0
      ? examenesConNota.reduce((s, e) => s + toNumber(e.nota, 0), 0) /
        examenesConNota.length
      : 0;
  const cantFinalesRendidos = examenesTodos.filter(
    (e) => e.tipo === "Final" && Number(e.rendido) === 1,
  ).length;
  const cantAusencias = examenesTodos.filter(
    (e) => Number(e.ausente) === 1,
  ).length;
  const totalIntentos = examenesTodos.length;
  const tasaAusencia = totalIntentos > 0 ? cantAusencias / totalIntentos : 0;
  const cantAprobados = examenesConNota.filter(
    (e) => toNumber(e.nota, 0) >= 4,
  ).length;
  const tasaAprobacion =
    cantExamenesRendidos > 0 ? cantAprobados / cantExamenesRendidos : 0;

  return {
    CantMaterias: cantMaterias,
    PromedioAsistencia: round4(promedioAsistencia),
    CantAniosCursados: cantAniosCursados,
    CantExamenesRendidos: cantExamenesRendidos,
    PromedioNota: round4(promedioNota),
    CantFinalesRendidos: cantFinalesRendidos,
    CantAusencias: cantAusencias,
    TasaAusencia: round4(tasaAusencia),
    CantAprobados: cantAprobados,
    TasaAprobacion: round4(tasaAprobacion),
    Edad: anioIngreso - anioNac,
    Genero: parseGenero(alumno.genero),
    AyudaFinanciera: Number(alumno.ayuda_financiera || 0),
    ColegioTecnico: Number(alumno.colegio_tecnico || 0),
    PromedioColegio: toNumber(alumno.promedio_colegio, 0),
    _meta: {
      nombre: alumno.nombre_completo,
      legajo,
      warningSinHistorial: cantMaterias === 0 && totalIntentos === 0,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// RECURSADO — features del modelo materia (11 features)
// ──────────────────────────────────────────────────────────────────────────────
function calcularVariablesRecursado(legajo, materiaId, anio) {
  const alumno = getAlumnoByLegajo(legajo);
  const materia = getMateria(materiaId);

  const cursada = db
    .prepare(
      `SELECT * FROM cursadas WHERE alumno_id = ? AND materia_id = ? AND anio = ? LIMIT 1`,
    )
    .get(legajo, materiaId, anio);

  if (!cursada) {
    throw new Error(
      `El alumno no tiene cursada registrada en ${materia.codigo} año ${anio}.`,
    );
  }

  const anioNac = getYearFromFecha(alumno.fecha_nac) || 2000;

  // Rendimiento general del alumno en exámenes (todas las materias)
  const todosExamenes = db
    .prepare(
      `SELECT nota, rendido FROM examenes WHERE alumno_id = ? AND rendido = 1 AND nota IS NOT NULL`,
    )
    .all(legajo);

  const promedioNotaGeneral =
    todosExamenes.length > 0
      ? todosExamenes.reduce((s, e) => s + toNumber(e.nota, 0), 0) /
        todosExamenes.length
      : 0;
  const aprobadosGeneral = todosExamenes.filter(
    (e) => toNumber(e.nota, 0) >= 4,
  ).length;
  const tasaAprobacionGeneral =
    todosExamenes.length > 0 ? aprobadosGeneral / todosExamenes.length : 0;

  const aprobadas = getAprobadas(legajo);
  const indiceBloqueo = calcularIndiceBloqueo(aprobadas, materia.correlativas);

  return {
    Edad: anio - anioNac,
    PromedioColegio: toNumber(alumno.promedio_colegio, 0),
    Asistencia: toNumber(cursada.asistencia, 0),
    AniosDesdeIngreso: anio - Number(alumno.anio_ingreso || anio),
    Materia: materia.codigo_plan || 0,
    PromedioNotaGeneral: round4(promedioNotaGeneral),
    TasaAprobacionGeneral: round4(tasaAprobacionGeneral),
    IndiceBloqueo: indiceBloqueo,
    Genero: parseGenero(alumno.genero),
    AyudaFinanciera: Number(alumno.ayuda_financiera || 0),
    ColegioTecnico: Number(alumno.colegio_tecnico || 0),
    _meta: {
      nombre: alumno.nombre_completo,
      legajo,
      materia: materia.codigo,
      anio,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// EXAMEN — features del modelo examen (31 features)
// ──────────────────────────────────────────────────────────────────────────────
function calcularVariablesExamen(legajo, materiaId, tipoExamen, instancia, anio) {
  const alumno = getAlumnoByLegajo(legajo);
  const materia = getMateria(materiaId);

  const anioNac = getYearFromFecha(alumno.fecha_nac) || 2000;

  const cursada = db
    .prepare(
      `SELECT * FROM cursadas WHERE alumno_id = ? AND materia_id = ? AND anio = ? LIMIT 1`,
    )
    .get(legajo, materiaId, anio);

  if (!cursada) {
    throw new Error(
      `El alumno no tiene cursada registrada en ${materia.codigo} año ${anio}.`,
    );
  }

  const asistencia = toNumber(cursada.asistencia, 0);
  const cuatrimestre = toNumber(cursada.cuatrimestre, 0);

  // Historial del alumno en esta materia (cursadas)
  const cursadasMateria = db
    .prepare(`SELECT * FROM cursadas WHERE alumno_id = ? AND materia_id = ?`)
    .all(legajo, materiaId);

  const vecesCursadaMateria = cursadasMateria.length;
  const recursadasMateria = cursadasMateria.filter(
    (c) => c.estado === "recursada",
  ).length;
  const tasaRecursaMateria =
    vecesCursadaMateria > 0 ? recursadasMateria / vecesCursadaMateria : 0;
  const promedioAsistenciaHistMateria =
    vecesCursadaMateria > 0
      ? cursadasMateria.reduce((s, c) => s + toNumber(c.asistencia, 0), 0) /
        vecesCursadaMateria
      : 0;

  // Historial general del alumno (todas las cursadas)
  const todasCursadas = db
    .prepare(`SELECT * FROM cursadas WHERE alumno_id = ?`)
    .all(legajo);

  const totalCursadasGeneral = todasCursadas.length;
  const recursadasGeneral = todasCursadas.filter(
    (c) => c.estado === "recursada",
  ).length;
  const tasaRecursaGeneral =
    totalCursadasGeneral > 0 ? recursadasGeneral / totalCursadasGeneral : 0;
  const promedioAsistenciaGeneral =
    totalCursadasGeneral > 0
      ? todasCursadas.reduce((s, c) => s + toNumber(c.asistencia, 0), 0) /
        totalCursadasGeneral
      : 0;

  // Parciales rendidos en la cursada actual
  const parcialesCursada = db
    .prepare(
      `SELECT nota FROM examenes
       WHERE alumno_id = ? AND materia_id = ? AND anio = ?
         AND tipo = 'Parcial' AND rendido = 1 AND nota IS NOT NULL`,
    )
    .all(legajo, materiaId, anio);

  const notaPromedioParcialCursada =
    parcialesCursada.length > 0
      ? parcialesCursada.reduce((s, e) => s + toNumber(e.nota, 0), 0) /
        parcialesCursada.length
      : 0;
  const cantParcialesAprobados = parcialesCursada.filter(
    (e) => toNumber(e.nota, 0) >= 4,
  ).length;

  // Veces recursada esta materia
  const vecesRecursada = recursadasMateria;

  // NotaPromedioCorrelativas
  const notaPromedioCorrelativas = calcularNotaPromedioCorrelativas(
    legajo,
    materia.correlativas,
  );

  // MateriasAprobadasHastaMomento
  const materiasAprobadas = db
    .prepare(
      `SELECT COUNT(*) AS total FROM cursadas WHERE alumno_id = ? AND estado = 'aprobada'`,
    )
    .get(legajo)?.total || 0;

  // CargaSimultanea: cuántas cursadas tiene el alumno en el mismo año
  const cargaSimultanea = db
    .prepare(`SELECT COUNT(*) AS total FROM cursadas WHERE alumno_id = ? AND anio = ?`)
    .get(legajo, anio)?.total || 1;

  // IndiceBloqueo
  const aprobadas = getAprobadas(legajo);
  const indiceBloqueo = calcularIndiceBloqueo(aprobadas, materia.correlativas);

  // PosicionFlujo
  const posMap = {
    "Parcial-1": 1, "Recuperatorio-1": 2,
    "Parcial-2": 3, "Recuperatorio-2": 4,
    "Final-1": 5, "Final-2": 6, "Final-3": 7,
  };
  const posicionFlujo = posMap[`${tipoExamen}-${Number(instancia)}`] || 1;

  return {
    Materia: materia.codigo_plan || 0,
    Cuatrimestre: cuatrimestre,
    Anio: anio,
    Instancia: Number(instancia),
    Genero: parseGenero(alumno.genero),
    AyudaFinanciera: Number(alumno.ayuda_financiera || 0),
    ColegioTecnico: Number(alumno.colegio_tecnico || 0),
    PromedioColegio: toNumber(alumno.promedio_colegio, 0),
    Asistencia: asistencia,
    VecesRecursada: vecesRecursada,
    "AñoCarrera": materia.anio_carrera || 1,
    NotaPromedioCorrelativas: notaPromedioCorrelativas,
    MateriasAprobadasHastaMomento: Number(materiasAprobadas),
    CargaSimultanea: Number(cargaSimultanea),
    IndiceBloqueo: indiceBloqueo,
    AniosDesdeIngreso: anio - Number(alumno.anio_ingreso || anio),
    VecesCursadaMateria: vecesCursadaMateria,
    TasaRecursaMateria: round4(tasaRecursaMateria),
    PromedioAsistenciaHistMateria: round4(promedioAsistenciaHistMateria),
    TotalCursadasGeneral: totalCursadasGeneral,
    TasaRecursaGeneral: round4(tasaRecursaGeneral),
    PromedioAsistenciaGeneral: round4(promedioAsistenciaGeneral),
    PosicionFlujo: posicionFlujo,
    NotaPromedioParcialCursada: round4(notaPromedioParcialCursada),
    CantParcialesAprobados: cantParcialesAprobados,
    Edad: anio - anioNac,
    // TipoExamen y Tipo se envían como strings; el AI service los OHE internamente
    TipoExamen: tipoExamen,
    Tipo: materia.tipo || "C",
    _meta: {
      nombre: alumno.nombre_completo,
      legajo,
      materia: materia.codigo,
      anio,
    },
  };
}

module.exports = {
  calcularVariablesAbandono,
  calcularVariablesRecursado,
  calcularVariablesExamen,
};
