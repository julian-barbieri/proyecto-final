const db = require("../db/database");

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round4(value) {
  return Number(toNumber(value, 0).toFixed(4));
}

function getYearFromFecha(fecha) {
  if (!fecha || typeof fecha !== "string") {
    return null;
  }

  const value = fecha.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return Number(value.slice(0, 4));
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    return Number(value.slice(6, 10));
  }

  return null;
}

function getAlumnoByLegajo(legajo) {
  const alumno = db
    .prepare(
      `
      SELECT
        id,
        username,
        COALESCE(nombre_completo, username) AS nombre_completo,
        email,
        promedio_colegio,
        anio_ingreso,
        genero,
        fecha_nac,
        ayuda_financiera,
        colegio_tecnico
      FROM users
      WHERE id = ? AND role = 'alumno'
      LIMIT 1
    `,
    )
    .get(legajo);

  if (!alumno) {
    throw new Error(`Alumno con legajo ${legajo} no encontrado.`);
  }

  return alumno;
}

function parseGenero(genero) {
  return String(genero || "")
    .trim()
    .toLowerCase() === "masculino"
    ? 1
    : 0;
}

function parseMateriaCodigo(codigo) {
  return String(codigo || "")
    .trim()
    .toUpperCase() === "AM2"
    ? 1
    : 0;
}

function calcularVariablesAbandono(legajo) {
  const alumno = getAlumnoByLegajo(legajo);

  const anioIngreso = Number(alumno.anio_ingreso || new Date().getFullYear());
  const anioNac = getYearFromFecha(alumno.fecha_nac) || 2000;

  const cursadasAlumno = db
    .prepare(
      `
      SELECT c.id, c.anio, c.asistencia, c.estado
      FROM cursadas c
      WHERE c.alumno_id = ?
    `,
    )
    .all(legajo);

  const cantMaterias = cursadasAlumno.length;
  const cantRecursa = cursadasAlumno.filter(
    (c) => c.estado === "recursada",
  ).length;
  const tasaRecursa = cantMaterias > 0 ? cantRecursa / cantMaterias : 0;
  const promedioAsistencia =
    cantMaterias > 0
      ? cursadasAlumno.reduce((sum, c) => sum + toNumber(c.asistencia, 0), 0) /
        cantMaterias
      : 0;
  const cantAniosCursados = new Set(cursadasAlumno.map((c) => Number(c.anio)))
    .size;

  const examenesTodos = db
    .prepare(
      `
      SELECT id, tipo, rendido, nota, ausente
      FROM examenes
      WHERE alumno_id = ?
    `,
    )
    .all(legajo);

  const cantExamenesRendidos = examenesTodos.filter(
    (e) => Number(e.rendido) === 1,
  ).length;
  const examenesConNota = examenesTodos.filter(
    (e) => Number(e.rendido) === 1 && e.nota !== null && e.nota !== undefined,
  );
  const promedioNota =
    examenesConNota.length > 0
      ? examenesConNota.reduce((sum, e) => sum + toNumber(e.nota, 0), 0) /
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

  const withoutAcademicHistory = cantMaterias === 0 && totalIntentos === 0;

  return {
    Genero: parseGenero(alumno.genero),
    Edad: anioIngreso - anioNac,
    AyudaFinanciera: Number(alumno.ayuda_financiera || 0),
    ColegioTecnico: Number(alumno.colegio_tecnico || 0),
    AnioIngreso: anioIngreso,
    PromedioColegio: toNumber(alumno.promedio_colegio, 0),
    CantMaterias: cantMaterias,
    CantRecursa: cantRecursa,
    TasaRecursa: round4(tasaRecursa),
    PromedioAsistencia: round4(promedioAsistencia),
    CantAniosCursados: cantAniosCursados,
    CantExamenesRendidos: cantExamenesRendidos,
    PromedioNota: round4(promedioNota),
    CantFinalesRendidos: cantFinalesRendidos,
    CantAusencias: cantAusencias,
    TasaAusencia: round4(tasaAusencia),
    CantAprobados: cantAprobados,
    TasaAprobacion: round4(tasaAprobacion),
    _meta: {
      nombre: alumno.nombre_completo,
      legajo,
      warningSinHistorial: withoutAcademicHistory,
    },
  };
}

function calcularVariablesRecursado(legajo, materiaId, anio) {
  const alumno = getAlumnoByLegajo(legajo);

  const materia = db
    .prepare("SELECT id, codigo, nombre FROM materias WHERE id = ? LIMIT 1")
    .get(materiaId);

  if (!materia) {
    throw new Error(`Materia ${materiaId} no encontrada.`);
  }

  const cursada = db
    .prepare(
      "SELECT * FROM cursadas WHERE alumno_id = ? AND materia_id = ? AND anio = ? LIMIT 1",
    )
    .get(legajo, materiaId, anio);

  if (!cursada) {
    throw new Error(
      `El alumno no tiene cursada registrada en ${materia.codigo} año ${anio}.`,
    );
  }

  const anioNac = getYearFromFecha(alumno.fecha_nac) || 2000;

  const examenesMateria = db
    .prepare("SELECT * FROM examenes WHERE alumno_id = ? AND materia_id = ?")
    .all(legajo, materiaId);

  const vecesRendidaExamenMateria = examenesMateria.filter(
    (e) => Number(e.rendido) === 1,
  ).length;
  const vecesAusenteMateria = examenesMateria.filter(
    (e) => Number(e.ausente) === 1,
  ).length;
  const examenesConNotaMateria = examenesMateria.filter(
    (e) => Number(e.rendido) === 1 && e.nota !== null && e.nota !== undefined,
  );

  const promedioNotaMateria =
    examenesConNotaMateria.length > 0
      ? examenesConNotaMateria.reduce(
          (sum, e) => sum + toNumber(e.nota, 0),
          0,
        ) / examenesConNotaMateria.length
      : 0;
  const aprobadosMateria = examenesConNotaMateria.filter(
    (e) => toNumber(e.nota, 0) >= 4,
  ).length;
  const tasaAprobacionMateria =
    vecesRendidaExamenMateria > 0
      ? aprobadosMateria / vecesRendidaExamenMateria
      : 0;

  const todosExamenes = db
    .prepare("SELECT * FROM examenes WHERE alumno_id = ?")
    .all(legajo);
  const todosConNota = todosExamenes.filter(
    (e) => Number(e.rendido) === 1 && e.nota !== null && e.nota !== undefined,
  );

  const promedioNotaGeneral =
    todosConNota.length > 0
      ? todosConNota.reduce((sum, e) => sum + toNumber(e.nota, 0), 0) /
        todosConNota.length
      : 0;
  const aprobadosGeneral = todosConNota.filter(
    (e) => toNumber(e.nota, 0) >= 4,
  ).length;
  const tasaAprobacionGeneral =
    todosConNota.length > 0 ? aprobadosGeneral / todosConNota.length : 0;

  return {
    Materia: parseMateriaCodigo(materia.codigo),
    Asistencia: toNumber(cursada.asistencia, 0),
    AyudaFinanciera: Number(alumno.ayuda_financiera || 0),
    ColegioTecnico: Number(alumno.colegio_tecnico || 0),
    PromedioColegio: toNumber(alumno.promedio_colegio, 0),
    AnioCursada: anio,
    Genero: parseGenero(alumno.genero),
    Edad: anio - anioNac,
    AniosDesdeIngreso: anio - Number(alumno.anio_ingreso || anio),
    VecesRendidaExamenMateria: vecesRendidaExamenMateria,
    VecesAusenteMateria: vecesAusenteMateria,
    PromedioNotaMateria: round4(promedioNotaMateria),
    TasaAprobacionMateria: round4(tasaAprobacionMateria),
    PromedioNotaGeneral: round4(promedioNotaGeneral),
    TasaAprobacionGeneral: round4(tasaAprobacionGeneral),
    _meta: {
      nombre: alumno.nombre_completo,
      legajo,
      materia: materia.codigo,
      anio,
    },
  };
}

function calcularVariablesExamen(
  legajo,
  materiaId,
  tipoExamen,
  instancia,
  anio,
) {
  const alumno = getAlumnoByLegajo(legajo);

  const materia = db
    .prepare("SELECT id, codigo, nombre FROM materias WHERE id = ? LIMIT 1")
    .get(materiaId);

  if (!materia) {
    throw new Error(`Materia ${materiaId} no encontrada.`);
  }

  const anioNac = getYearFromFecha(alumno.fecha_nac) || 2000;

  const cursada = db
    .prepare(
      "SELECT * FROM cursadas WHERE alumno_id = ? AND materia_id = ? AND anio = ? LIMIT 1",
    )
    .get(legajo, materiaId, anio);

  if (!cursada) {
    throw new Error(
      `El alumno no tiene cursada registrada en ${materia.codigo} año ${anio}.`,
    );
  }

  const asistencia = toNumber(cursada.asistencia, 0);
  const asistenciaBajaRiesgo = asistencia < 0.75 ? 1 : 0;

  const cursadasMateria = db
    .prepare("SELECT * FROM cursadas WHERE alumno_id = ? AND materia_id = ?")
    .all(legajo, materiaId);

  const vecesCursadaMateria = cursadasMateria.length;
  const recursadasMateria = cursadasMateria.filter(
    (c) => c.estado === "recursada",
  ).length;
  const tasaRecursaMateria =
    vecesCursadaMateria > 0 ? recursadasMateria / vecesCursadaMateria : 0;
  const promedioAsistenciaHistMateria =
    vecesCursadaMateria > 0
      ? cursadasMateria.reduce((sum, c) => sum + toNumber(c.asistencia, 0), 0) /
        vecesCursadaMateria
      : 0;

  const todasCursadas = db
    .prepare("SELECT * FROM cursadas WHERE alumno_id = ?")
    .all(legajo);

  const totalCursadasGeneral = todasCursadas.length;
  const recursadasGeneral = todasCursadas.filter(
    (c) => c.estado === "recursada",
  ).length;
  const tasaRecursaGeneral =
    totalCursadasGeneral > 0 ? recursadasGeneral / totalCursadasGeneral : 0;
  const promedioAsistenciaGeneral =
    totalCursadasGeneral > 0
      ? todasCursadas.reduce((sum, c) => sum + toNumber(c.asistencia, 0), 0) /
        totalCursadasGeneral
      : 0;

  const examenesCursadaActual = db
    .prepare(
      "SELECT * FROM examenes WHERE alumno_id = ? AND materia_id = ? AND anio = ?",
    )
    .all(legajo, materiaId, anio);

  const parcialesRendidos = examenesCursadaActual.filter(
    (e) =>
      e.tipo === "Parcial" &&
      Number(e.rendido) === 1 &&
      e.nota !== null &&
      e.nota !== undefined,
  );

  const notaPromedioParcialCursada =
    parcialesRendidos.length > 0
      ? parcialesRendidos.reduce((sum, e) => sum + toNumber(e.nota, 0), 0) /
        parcialesRendidos.length
      : 0;

  const cantParcialesAprobados = parcialesRendidos.filter(
    (e) => toNumber(e.nota, 0) >= 4,
  ).length;

  const am1 = db
    .prepare("SELECT id FROM materias WHERE codigo = 'AM1' LIMIT 1")
    .get();

  const tieneFinalAM1 = am1
    ? Number(
        db
          .prepare(
            `
            SELECT COUNT(*) AS total
            FROM examenes
            WHERE alumno_id = ?
              AND materia_id = ?
              AND tipo = 'Final'
              AND rendido = 1
              AND nota >= 4
          `,
          )
          .get(legajo, am1.id)?.total || 0,
      ) > 0
      ? 1
      : 0
    : 0;

  const esUltimaInstancia =
    tipoExamen === "Final" && Number(instancia) === 3 ? 1 : 0;

  const posMap = {
    "Parcial-1": 1,
    "Recuperatorio-1": 2,
    "Parcial-2": 3,
    "Recuperatorio-2": 4,
    "Final-1": 5,
    "Final-2": 6,
    "Final-3": 7,
  };

  const posicionFlujo = posMap[`${tipoExamen}-${Number(instancia)}`] || 1;

  return {
    Materia: parseMateriaCodigo(materia.codigo),
    TipoExamen: tipoExamen,
    Instancia: Number(instancia),
    Anio: anio,
    Asistencia: asistencia,
    VecesRecursada: recursadasMateria,
    Genero: parseGenero(alumno.genero),
    Edad: anio - anioNac,
    AyudaFinanciera: Number(alumno.ayuda_financiera || 0),
    ColegioTecnico: Number(alumno.colegio_tecnico || 0),
    PromedioColegio: toNumber(alumno.promedio_colegio, 0),
    AniosDesdeIngreso: anio - Number(alumno.anio_ingreso || anio),
    VecesCursadaMateria: vecesCursadaMateria,
    TasaRecursaMateria: round4(tasaRecursaMateria),
    PromedioAsistenciaHistMateria: round4(promedioAsistenciaHistMateria),
    TotalCursadasGeneral: totalCursadasGeneral,
    TasaRecursaGeneral: round4(tasaRecursaGeneral),
    PromedioAsistenciaGeneral: round4(promedioAsistenciaGeneral),
    PosicionFlujo: posicionFlujo,
    AsistenciaBajaRiesgo: asistenciaBajaRiesgo,
    NotaPromedioParcialCursada: round4(notaPromedioParcialCursada),
    CantParcialesAprobados: cantParcialesAprobados,
    EsUltimaInstancia: esUltimaInstancia,
    TieneFinalAM1: tieneFinalAM1,
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
