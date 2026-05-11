const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const db = require("../db/database");
const { authorize } = require("../middleware/auth.middleware");

const router = express.Router();

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isXlsx =
      String(file?.originalname || "")
        .toLowerCase()
        .endsWith(".xlsx") ||
      String(file?.mimetype || "").includes("spreadsheetml");

    if (!isXlsx) {
      return cb(new Error("Solo se permiten archivos .xlsx"));
    }

    return cb(null, true);
  },
});

router.use(authorize("docente"));

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function toNullableFloat(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFlag(value, fallback = 0) {
  if (value === true || value === 1 || value === "1") {
    return 1;
  }
  if (value === false || value === 0 || value === "0") {
    return 0;
  }
  return fallback;
}

function normalizeTipo(tipo) {
  if (typeof tipo !== "string") {
    return null;
  }
  const trimmed = tipo.trim();
  return ["Parcial", "Recuperatorio", "Final"].includes(trimmed)
    ? trimmed
    : null;
}

function normalizeFechaExamen(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) {
      return null;
    }
    const day = String(date.d).padStart(2, "0");
    const month = String(date.m).padStart(2, "0");
    return `${day}-${month}-${date.y}`;
  }

  const raw = String(value).trim();

  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    return raw;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return `${day}-${month}-${year}`;
  }

  return null;
}

function docenteTieneAsignacionActiva(docenteId, materiaId) {
  const row = db
    .prepare(
      `
      SELECT id
      FROM docente_materia
      WHERE docente_id = ? AND materia_id = ? AND activo = 1
      LIMIT 1
    `,
    )
    .get(docenteId, materiaId);

  return Boolean(row?.id);
}

function existsAlumno(alumnoId) {
  return Boolean(
    db
      .prepare("SELECT id FROM users WHERE id = ? AND role = 'alumno' LIMIT 1")
      .get(alumnoId),
  );
}

function existsCursada(alumnoId, materiaId, anio) {
  return Boolean(
    db
      .prepare(
        "SELECT id FROM cursadas WHERE alumno_id = ? AND materia_id = ? AND anio = ? LIMIT 1",
      )
      .get(alumnoId, materiaId, anio),
  );
}

const upsertExamenTx = db.transaction((payload) => {
  const existing = db
    .prepare(
      `
      SELECT id
      FROM examenes
      WHERE alumno_id = ? AND materia_id = ? AND anio = ? AND tipo = ? AND instancia = ?
      LIMIT 1
    `,
    )
    .get(
      payload.alumno_id,
      payload.materia_id,
      payload.anio,
      payload.tipo,
      payload.instancia,
    );

  if (existing) {
    db.prepare(
      `
      UPDATE examenes
      SET
        rendido = ?,
        nota = ?,
        ausente = ?,
        veces_recursada = ?,
        fecha_examen = ?,
        asistencia = ?
      WHERE id = ?
    `,
    ).run(
      payload.rendido,
      payload.nota,
      payload.ausente,
      payload.veces_recursada,
      payload.fecha_examen,
      payload.asistencia,
      existing.id,
    );

    return db.prepare("SELECT * FROM examenes WHERE id = ?").get(existing.id);
  }

  const inserted = db
    .prepare(
      `
      INSERT INTO examenes (
        alumno_id,
        materia_id,
        anio,
        tipo,
        instancia,
        rendido,
        nota,
        ausente,
        veces_recursada,
        fecha_examen,
        asistencia
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      payload.alumno_id,
      payload.materia_id,
      payload.anio,
      payload.tipo,
      payload.instancia,
      payload.rendido,
      payload.nota,
      payload.ausente,
      payload.veces_recursada,
      payload.fecha_examen,
      payload.asistencia,
    );

  return db
    .prepare("SELECT * FROM examenes WHERE id = ?")
    .get(Number(inserted.lastInsertRowid));
});

function validateExamenPayload(payload) {
  const alumnoId = toPositiveInt(payload.alumno_id);
  const materiaId = toPositiveInt(payload.materia_id);
  const anio = toPositiveInt(payload.anio);
  const tipo = normalizeTipo(payload.tipo);
  const instancia = toPositiveInt(payload.instancia);
  const rendido = normalizeFlag(payload.rendido, 0);
  const ausente = normalizeFlag(payload.ausente, 0);
  const vecesRecursada = toPositiveInt(payload.veces_recursada) || 0;
  const asistencia = toNullableFloat(payload.asistencia);
  const fechaExamen = normalizeFechaExamen(payload.fecha_examen);

  if (!alumnoId || !materiaId || !anio || !tipo || !instancia) {
    throw new Error("Datos de examen incompletos o inválidos.");
  }

  if (![1, 2, 3].includes(instancia)) {
    throw new Error("Instancia inválida. Debe ser 1, 2 o 3.");
  }

  if (asistencia !== null && (asistencia < 0 || asistencia > 1)) {
    throw new Error("La asistencia debe estar entre 0 y 1.");
  }

  let nota = toNullableFloat(payload.nota);

  if (ausente === 1 || rendido === 0) {
    nota = null;
  }

  if (nota !== null && (nota < 1 || nota > 10)) {
    throw new Error("La nota debe estar entre 1 y 10.");
  }

  return {
    alumno_id: alumnoId,
    materia_id: materiaId,
    anio,
    tipo,
    instancia,
    rendido,
    ausente,
    nota,
    veces_recursada: vecesRecursada,
    asistencia,
    fecha_examen: fechaExamen,
  };
}

router.get("/alumnos-materia/:materiaId", (req, res) => {
  const materiaId = toPositiveInt(req.params.materiaId);
  const anio = req.query.anio
    ? toPositiveInt(req.query.anio)
    : new Date().getFullYear();

  if (!materiaId || !anio) {
    return res.status(400).json({ error: "Materia o año inválido." });
  }

  if (!docenteTieneAsignacionActiva(req.user.id, materiaId)) {
    return res
      .status(403)
      .json({ error: "No tenés asignación activa para esta materia." });
  }

  const alumnos = db
    .prepare(
      `
      SELECT DISTINCT
        u.id AS legajo,
        COALESCE(u.nombre_completo, u.username) AS nombre_completo
      FROM users u
      JOIN inscripciones i ON i.alumno_id = u.id
      WHERE u.role = 'alumno'
        AND i.materia_id = ?
        AND i.anio = ?
        AND i.estado = 'activa'
      ORDER BY nombre_completo ASC
    `,
    )
    .all(materiaId, anio);

  const examenesByAlumno = db
    .prepare(
      `
      SELECT
        id,
        alumno_id,
        tipo,
        instancia,
        nota,
        rendido,
        ausente,
        fecha_examen,
        asistencia,
        veces_recursada
      FROM examenes
      WHERE materia_id = ? AND anio = ?
      ORDER BY
        alumno_id ASC,
        CASE tipo
          WHEN 'Parcial' THEN 1
          WHEN 'Recuperatorio' THEN 2
          WHEN 'Final' THEN 3
          ELSE 4
        END ASC,
        instancia ASC
    `,
    )
    .all(materiaId, anio)
    .reduce((acc, examen) => {
      const key = String(examen.alumno_id);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push({
        id: examen.id,
        tipo: examen.tipo,
        instancia: examen.instancia,
        nota: examen.nota,
        rendido: examen.rendido,
        ausente: examen.ausente,
        fecha_examen: examen.fecha_examen,
        asistencia: examen.asistencia,
        veces_recursada: examen.veces_recursada,
      });
      return acc;
    }, {});

  const data = alumnos.map((alumno) => ({
    ...alumno,
    examenes: examenesByAlumno[String(alumno.legajo)] || [],
  }));

  return res.status(200).json(data);
});

router.post("/examenes", (req, res) => {
  let payload;

  try {
    payload = validateExamenPayload(req.body || {});
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }

  if (!existsAlumno(payload.alumno_id)) {
    return res
      .status(422)
      .json({ error: "El alumno seleccionado no existe o no es válido." });
  }

  if (!docenteTieneAsignacionActiva(req.user.id, payload.materia_id)) {
    return res
      .status(403)
      .json({ error: "No tenés asignación activa para esta materia." });
  }

  if (!existsCursada(payload.alumno_id, payload.materia_id, payload.anio)) {
    return res.status(400).json({
      error: "El alumno no tiene cursada registrada para esa materia y año.",
    });
  }

  const examen = upsertExamenTx(payload);

  db.prepare(
    `
    INSERT INTO importaciones_log (docente_id, materia_id, anio, tipo, filas_ok, filas_error)
    VALUES (?, ?, ?, 'manual', 1, 0)
  `,
  ).run(req.user.id, payload.materia_id, payload.anio);

  return res.status(201).json(examen);
});

router.post("/importar-excel", (req, res) => {
  uploadExcel.single("archivo")(req, res, (uploadError) => {
    if (uploadError) {
      return res
        .status(422)
        .json({ error: uploadError.message || "Archivo inválido." });
    }

    if (!req.file?.buffer) {
      return res.status(422).json({ error: "No se recibió ningún archivo." });
    }

    let rows = [];

    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    } catch {
      return res
        .status(422)
        .json({ error: "No se pudo leer el archivo Excel." });
    }

    const requiredColumns = [
      "Legajo",
      "Materia",
      "Anio",
      "TipoExamen",
      "Instancia",
      "ExamenRendido",
      "AusenteExamen",
      "Nota",
      "VecesRecursada",
      "Asistencia",
      "FechaExamen",
    ];

    const firstRow = rows[0] || {};
    const missingColumns = requiredColumns.filter(
      (column) => !(column in firstRow),
    );

    if (rows.length > 0 && missingColumns.length > 0) {
      return res.status(422).json({
        error: "Formato de archivo inválido.",
        missing_columns: missingColumns,
      });
    }

    const errores = [];
    let filasOk = 0;
    const materiaAnio = new Map();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;

      const legajo = toPositiveInt(row.Legajo);
      const anio = toPositiveInt(row.Anio);
      const tipo = normalizeTipo(row.TipoExamen);
      const instancia = toPositiveInt(row.Instancia);
      const materiaCodigo = String(row.Materia || "")
        .trim()
        .toUpperCase();
      const materia = db
        .prepare(
          "SELECT id, codigo FROM materias WHERE UPPER(codigo) = ? LIMIT 1",
        )
        .get(materiaCodigo);

      if (!legajo || !anio || !tipo || !instancia || !materia) {
        errores.push({
          fila: rowNumber,
          motivo: "Datos obligatorios inválidos en la fila.",
        });
        continue;
      }

      if (!existsAlumno(legajo)) {
        errores.push({
          fila: rowNumber,
          motivo: `Alumno ${legajo} no encontrado`,
        });
        continue;
      }

      if (!docenteTieneAsignacionActiva(req.user.id, materia.id)) {
        errores.push({
          fila: rowNumber,
          motivo: `Sin asignación docente activa para materia ${materia.codigo}`,
        });
        continue;
      }

      if (!existsCursada(legajo, materia.id, anio)) {
        errores.push({
          fila: rowNumber,
          motivo: `El alumno ${legajo} no tiene cursada en ${materia.codigo} año ${anio}`,
        });
        continue;
      }

      let parsed;
      try {
        parsed = validateExamenPayload({
          alumno_id: legajo,
          materia_id: materia.id,
          anio,
          tipo,
          instancia,
          nota: row.Nota,
          rendido: row.ExamenRendido,
          ausente: row.AusenteExamen,
          veces_recursada: row.VecesRecursada,
          asistencia: row.Asistencia,
          fecha_examen: row.FechaExamen,
        });
      } catch (error) {
        errores.push({ fila: rowNumber, motivo: error.message });
        continue;
      }

      upsertExamenTx(parsed);
      filasOk += 1;
      materiaAnio.set(`${materia.id}-${anio}`, { materiaId: materia.id, anio });
    }

    for (const key of materiaAnio.keys()) {
      const item = materiaAnio.get(key);
      db.prepare(
        `
        INSERT INTO importaciones_log (docente_id, materia_id, anio, tipo, filas_ok, filas_error)
        VALUES (?, ?, ?, 'excel', ?, ?)
      `,
      ).run(req.user.id, item.materiaId, item.anio, filasOk, errores.length);
    }

    return res
      .status(200)
      .json({ filas_ok: filasOk, filas_error: errores.length, errores });
  });
});

module.exports = router;
