const express = require("express");
const db = require("../db/database");
const { authorize } = require("../middleware/auth.middleware");

const router = express.Router();

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function getTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function normalizeBoolean(value) {
  return value === true || value === 1 || value === "1";
}

function getActivePeriodo() {
  return db
    .prepare(
      `
      SELECT id, anio, descripcion, fecha_inicio, fecha_fin, activo
      FROM periodos_inscripcion
      WHERE activo = 1
      ORDER BY id DESC
      LIMIT 1
    `,
    )
    .get();
}

function isPeriodoVigente(periodo) {
  if (!periodo || Number(periodo.activo) !== 1) {
    return false;
  }

  const today = getTodayUTC();
  const inicio = parseISODate(periodo.fecha_inicio);
  const fin = parseISODate(periodo.fecha_fin);

  if (!inicio || !fin) {
    return false;
  }

  return today >= inicio && today <= fin;
}

function getDocentesNombresByMateriaAndYear(materiaId, anio) {
  const rows = db
    .prepare(
      `
      SELECT COALESCE(u.nombre_completo, u.username) AS docente_nombre
      FROM docente_materia dm
      JOIN users u ON u.id = dm.docente_id
      WHERE dm.materia_id = ? AND dm.anio = ? AND dm.activo = 1
      ORDER BY docente_nombre ASC
    `,
    )
    .all(materiaId, anio);

  return rows.map((row) => row.docente_nombre);
}

function isMateriaAprobada(alumnoId, materiaId) {
  const hasCursadaAprobada = Boolean(
    db
      .prepare(
        "SELECT 1 AS ok FROM cursadas WHERE alumno_id = ? AND materia_id = ? AND estado = 'aprobada' LIMIT 1",
      )
      .get(alumnoId, materiaId),
  );

  const hasFinalAprobado = Boolean(
    db
      .prepare(
        "SELECT 1 AS ok FROM examenes WHERE alumno_id = ? AND materia_id = ? AND tipo = 'Final' AND rendido = 1 AND nota >= 4 LIMIT 1",
      )
      .get(alumnoId, materiaId),
  );

  return hasCursadaAprobada && hasFinalAprobado;
}

// Lista todas las materias del plan con sus metadatos (usado por formularios de predicción)
router.get("/materias", (req, res) => {
  const materias = db
    .prepare(
      `SELECT id, nombre, codigo, codigo_plan, tipo, anio_carrera, correlativas
       FROM materias
       WHERE codigo_plan IS NOT NULL
       ORDER BY codigo_plan ASC`,
    )
    .all()
    .map((m) => ({
      ...m,
      correlativas: JSON.parse(m.correlativas || "[]"),
    }));
  return res.json(materias);
});

router.get("/periodos", authorize("admin", "coordinador"), (req, res) => {
  const periodos = db
    .prepare(
      `
      SELECT
        p.id,
        p.anio,
        p.descripcion,
        p.fecha_inicio,
        p.fecha_fin,
        p.activo,
        p.created_at,
        (
          SELECT COUNT(*)
          FROM inscripciones i
          WHERE i.periodo_id = p.id
        ) AS inscripciones_asociadas,
        COALESCE(u.nombre_completo, u.username) AS creado_por_nombre
      FROM periodos_inscripcion p
      JOIN users u ON u.id = p.creado_por
      ORDER BY p.anio DESC, p.fecha_inicio DESC
    `,
    )
    .all();

  return res.status(200).json(periodos);
});

router.post("/periodos", authorize("admin", "coordinador"), (req, res) => {
  const currentYear = new Date().getFullYear();
  const anio = Number(req.body.anio);
  const descripcion = String(req.body.descripcion || "").trim();
  const fechaInicioRaw = String(req.body.fecha_inicio || "").trim();
  const fechaFinRaw = String(req.body.fecha_fin || "").trim();
  const activo = normalizeBoolean(req.body.activo);

  if (!Number.isInteger(anio) || anio < currentYear || anio > currentYear + 2) {
    return res
      .status(422)
      .json({ message: "El año debe estar entre el actual y +2." });
  }

  if (descripcion.length > 100) {
    return res
      .status(422)
      .json({ message: "La descripción no puede superar 100 caracteres." });
  }

  const fechaInicio = parseISODate(fechaInicioRaw);
  const fechaFin = parseISODate(fechaFinRaw);

  if (!fechaInicio || !fechaFin) {
    return res
      .status(422)
      .json({ message: "Las fechas deben tener formato YYYY-MM-DD." });
  }

  if (fechaInicio < getTodayUTC()) {
    return res
      .status(422)
      .json({ message: "La fecha de inicio no puede ser anterior a hoy." });
  }

  if (fechaFin <= fechaInicio) {
    return res
      .status(422)
      .json({ message: "La fecha de fin debe ser posterior al inicio." });
  }

  const created = db.transaction(() => {
    if (activo) {
      db.prepare("UPDATE periodos_inscripcion SET activo = 0").run();
    }

    const result = db
      .prepare(
        `
        INSERT INTO periodos_inscripcion (
          anio,
          descripcion,
          fecha_inicio,
          fecha_fin,
          activo,
          creado_por
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        anio,
        descripcion || null,
        fechaInicioRaw,
        fechaFinRaw,
        activo ? 1 : 0,
        req.user.id,
      );

    return db
      .prepare(
        `
        SELECT
          p.id,
          p.anio,
          p.descripcion,
          p.fecha_inicio,
          p.fecha_fin,
          p.activo,
          p.created_at,
          0 AS inscripciones_asociadas,
          COALESCE(u.nombre_completo, u.username) AS creado_por_nombre
        FROM periodos_inscripcion p
        JOIN users u ON u.id = p.creado_por
        WHERE p.id = ?
      `,
      )
      .get(result.lastInsertRowid);
  })();

  return res.status(201).json(created);
});

router.patch(
  "/periodos/:id/activar",
  authorize("admin", "coordinador"),
  (req, res) => {
    const periodoId = toPositiveInt(req.params.id);
    if (!periodoId) {
      return res.status(400).json({ message: "Período inválido." });
    }

    const periodo = db
      .prepare("SELECT id FROM periodos_inscripcion WHERE id = ? LIMIT 1")
      .get(periodoId);

    if (!periodo) {
      return res.status(404).json({ message: "Período no encontrado." });
    }

    db.transaction(() => {
      db.prepare("UPDATE periodos_inscripcion SET activo = 0").run();
      db.prepare("UPDATE periodos_inscripcion SET activo = 1 WHERE id = ?").run(
        periodoId,
      );
    })();

    return res.status(200).json({ message: "Período activado correctamente" });
  },
);

router.patch(
  "/periodos/:id/desactivar",
  authorize("admin", "coordinador"),
  (req, res) => {
    const periodoId = toPositiveInt(req.params.id);
    if (!periodoId) {
      return res.status(400).json({ message: "Período inválido." });
    }

    const updated = db
      .prepare("UPDATE periodos_inscripcion SET activo = 0 WHERE id = ?")
      .run(periodoId);

    if (updated.changes === 0) {
      return res.status(404).json({ message: "Período no encontrado." });
    }

    return res
      .status(200)
      .json({ message: "Período desactivado correctamente" });
  },
);

router.delete(
  "/periodos/:id",
  authorize("admin", "coordinador"),
  (req, res) => {
    const periodoId = toPositiveInt(req.params.id);
    if (!periodoId) {
      return res.status(400).json({ message: "Período inválido." });
    }

    const periodo = db
      .prepare("SELECT id FROM periodos_inscripcion WHERE id = ? LIMIT 1")
      .get(periodoId);

    if (!periodo) {
      return res.status(404).json({ message: "Período no encontrado." });
    }

    const inscripcionesCount = db
      .prepare(
        "SELECT COUNT(*) AS total FROM inscripciones WHERE periodo_id = ?",
      )
      .get(periodoId)?.total;

    if (Number(inscripcionesCount) > 0) {
      return res.status(409).json({
        message: "No se puede eliminar un período con inscripciones asociadas.",
      });
    }

    db.prepare("DELETE FROM periodos_inscripcion WHERE id = ?").run(periodoId);
    return res.status(204).send();
  },
);

router.get("/asignaciones", authorize("admin", "coordinador"), (req, res) => {
  const anio = req.query.anio ? Number(req.query.anio) : null;
  const activo =
    req.query.activo === "0" || req.query.activo === "1"
      ? Number(req.query.activo)
      : null;

  const conditions = [];
  const params = [];

  if (Number.isInteger(anio)) {
    conditions.push("dm.anio = ?");
    params.push(anio);
  }

  if (activo === 0 || activo === 1) {
    conditions.push("dm.activo = ?");
    params.push(activo);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const query = `
    SELECT
      dm.id,
      dm.docente_id,
      COALESCE(d.nombre_completo, d.username) AS docente_nombre,
      dm.materia_id,
      m.nombre AS materia_nombre,
      m.codigo AS materia_codigo,
      dm.anio,
      dm.activo,
      COALESCE(a.nombre_completo, a.username) AS asignado_por_nombre,
      dm.created_at
    FROM docente_materia dm
    JOIN users d ON d.id = dm.docente_id
    JOIN materias m ON m.id = dm.materia_id
    JOIN users a ON a.id = dm.asignado_por
    ${whereClause}
    ORDER BY dm.anio DESC, m.nombre ASC
  `;

  const rows = db.prepare(query).all(...params);
  return res.status(200).json(rows);
});

router.post("/asignaciones", authorize("admin", "coordinador"), (req, res) => {
  const docenteId = toPositiveInt(req.body.docente_id);
  const materiaId = toPositiveInt(req.body.materia_id);
  const anio = Number(req.body.anio);
  const currentYear = new Date().getFullYear();

  if (!docenteId || !materiaId || !Number.isInteger(anio)) {
    return res
      .status(422)
      .json({ message: "Docente, materia y año son obligatorios." });
  }

  if (anio < currentYear - 5 || anio > currentYear + 2) {
    return res
      .status(422)
      .json({ message: "El año es inválido para una asignación." });
  }

  const docente = db
    .prepare("SELECT id FROM users WHERE id = ? AND role = 'docente' LIMIT 1")
    .get(docenteId);

  if (!docente) {
    return res
      .status(422)
      .json({ message: "El usuario seleccionado no es un docente válido." });
  }

  const materia = db
    .prepare("SELECT id FROM materias WHERE id = ? LIMIT 1")
    .get(materiaId);

  if (!materia) {
    return res
      .status(422)
      .json({ message: "La materia seleccionada no existe." });
  }

  const existing = db
    .prepare(
      "SELECT id, activo FROM docente_materia WHERE docente_id = ? AND materia_id = ? AND anio = ? LIMIT 1",
    )
    .get(docenteId, materiaId, anio);

  if (existing && Number(existing.activo) === 1) {
    return res.status(409).json({
      message: "Este docente ya está asignado a esta materia para ese año.",
    });
  }

  if (existing && Number(existing.activo) === 0) {
    db.prepare(
      "UPDATE docente_materia SET activo = 1, asignado_por = ? WHERE id = ?",
    ).run(req.user.id, existing.id);

    const reactivated = db
      .prepare(
        `
        SELECT
          dm.id,
          dm.docente_id,
          COALESCE(d.nombre_completo, d.username) AS docente_nombre,
          dm.materia_id,
          m.nombre AS materia_nombre,
          m.codigo AS materia_codigo,
          dm.anio,
          dm.activo,
          COALESCE(a.nombre_completo, a.username) AS asignado_por_nombre,
          dm.created_at
        FROM docente_materia dm
        JOIN users d ON d.id = dm.docente_id
        JOIN materias m ON m.id = dm.materia_id
        JOIN users a ON a.id = dm.asignado_por
        WHERE dm.id = ?
      `,
      )
      .get(existing.id);

    return res.status(201).json(reactivated);
  }

  const createdResult = db
    .prepare(
      `
      INSERT INTO docente_materia (
        docente_id,
        materia_id,
        anio,
        activo,
        asignado_por
      ) VALUES (?, ?, ?, 1, ?)
    `,
    )
    .run(docenteId, materiaId, anio, req.user.id);

  const created = db
    .prepare(
      `
      SELECT
        dm.id,
        dm.docente_id,
        COALESCE(d.nombre_completo, d.username) AS docente_nombre,
        dm.materia_id,
        m.nombre AS materia_nombre,
        m.codigo AS materia_codigo,
        dm.anio,
        dm.activo,
        COALESCE(a.nombre_completo, a.username) AS asignado_por_nombre,
        dm.created_at
      FROM docente_materia dm
      JOIN users d ON d.id = dm.docente_id
      JOIN materias m ON m.id = dm.materia_id
      JOIN users a ON a.id = dm.asignado_por
      WHERE dm.id = ?
    `,
    )
    .get(createdResult.lastInsertRowid);

  return res.status(201).json(created);
});

router.delete(
  "/asignaciones/:id",
  authorize("admin", "coordinador"),
  (req, res) => {
    const asignacionId = toPositiveInt(req.params.id);
    if (!asignacionId) {
      return res.status(400).json({ message: "Asignación inválida." });
    }

    const existing = db
      .prepare("SELECT id, activo FROM docente_materia WHERE id = ? LIMIT 1")
      .get(asignacionId);

    if (!existing) {
      return res.status(404).json({ message: "Asignación no encontrada." });
    }

    if (Number(existing.activo) === 0) {
      return res
        .status(409)
        .json({ message: "La asignación ya está inactiva." });
    }

    db.prepare("UPDATE docente_materia SET activo = 0 WHERE id = ?").run(
      asignacionId,
    );
    return res
      .status(200)
      .json({ message: "Docente desasignado correctamente" });
  },
);

router.get("/docentes", authorize("admin", "coordinador"), (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        u.id,
        u.nombre_completo,
        u.email,
        (
          SELECT COUNT(*)
          FROM docente_materia dm
          WHERE dm.docente_id = u.id AND dm.activo = 1
        ) AS materias_activas
      FROM users u
      WHERE u.role = 'docente'
      ORDER BY COALESCE(u.nombre_completo, u.username) ASC
    `,
    )
    .all();

  return res.status(200).json(rows);
});

router.get(
  "/alumnos-por-materia/:materiaId",
  authorize("docente", "admin", "coordinador"),
  (req, res) => {
    const materiaId = toPositiveInt(req.params.materiaId);

    if (!materiaId) {
      return res.status(400).json({ message: "Materia inválida." });
    }

    const alumnos = db
      .prepare(
        `
      SELECT DISTINCT
        u.id,
        COALESCE(u.nombre_completo, u.username) AS nombre,
        u.email
      FROM inscripciones i
      JOIN users u ON u.id = i.alumno_id
      WHERE i.materia_id = ?
        AND i.estado = 'activa'
        AND u.role = 'alumno'
      ORDER BY nombre ASC
    `,
      )
      .all(materiaId);

    return res.status(200).json(alumnos);
  },
);

router.get(
  "/materias-disponibles",
  authorize("admin", "coordinador"),
  (req, res) => {
    const currentYear = new Date().getFullYear();

    const materias = db
      .prepare("SELECT id, nombre, codigo FROM materias ORDER BY nombre ASC")
      .all();

    const response = materias.map((materia) => {
      const docentes = db
        .prepare(
          `
        SELECT
          dm.docente_id,
          COALESCE(u.nombre_completo, u.username) AS docente_nombre,
          dm.anio
        FROM docente_materia dm
        JOIN users u ON u.id = dm.docente_id
        WHERE dm.materia_id = ? AND dm.anio = ? AND dm.activo = 1
        ORDER BY docente_nombre ASC
      `,
        )
        .all(materia.id, currentYear);

      return {
        ...materia,
        docentes_actuales: docentes,
      };
    });

    return res.status(200).json(response);
  },
);

router.get("/mis-materias", authorize("docente"), (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        dm.id,
        dm.docente_id,
        dm.materia_id,
        dm.anio,
        dm.activo,
        m.nombre AS materia_nombre,
        m.codigo AS materia_codigo,
        m.descripcion AS materia_descripcion,
        (
          SELECT COUNT(*)
          FROM inscripciones i
          WHERE i.materia_id = dm.materia_id
            AND i.anio = dm.anio
            AND i.estado = 'activa'
        ) AS cantidad_alumnos
      FROM docente_materia dm
      JOIN materias m ON dm.materia_id = m.id
      WHERE dm.docente_id = ?
      ORDER BY dm.anio DESC, m.nombre ASC
    `,
    )
    .all(req.user.id);

  const activas = rows.filter((row) => Number(row.activo) === 1);
  const historial = rows.filter((row) => Number(row.activo) === 0);

  return res.status(200).json({ activas, historial });
});

router.get("/inscripcion/disponibles", authorize("alumno"), (req, res) => {
  const alumnoId = req.user.id;
  const currentYear = new Date().getFullYear();
  const periodoActivo = getActivePeriodo();
  const periodoDisponible = periodoActivo && isPeriodoVigente(periodoActivo);

  const materias = db
    .prepare("SELECT id, nombre, codigo FROM materias ORDER BY nombre ASC")
    .all();

  const am1 = materias.find((materia) => materia.codigo === "AM1");
  const am2 = materias.find((materia) => materia.codigo === "AM2");

  const hasAM1CursadaAprobada = am1
    ? Boolean(
        db
          .prepare(
            "SELECT 1 AS ok FROM cursadas WHERE alumno_id = ? AND materia_id = ? AND estado = 'aprobada' LIMIT 1",
          )
          .get(alumnoId, am1.id),
      )
    : false;

  const hasAM1FinalAprobado = am1
    ? Boolean(
        db
          .prepare(
            "SELECT 1 AS ok FROM examenes WHERE alumno_id = ? AND materia_id = ? AND tipo = 'Final' AND rendido = 1 AND nota >= 4 LIMIT 1",
          )
          .get(alumnoId, am1.id),
      )
    : false;

  const response = materias.map((materia) => {
    const yaInscriptoReal = Boolean(
      db
        .prepare(
          "SELECT 1 AS ok FROM inscripciones WHERE alumno_id = ? AND materia_id = ? AND anio = ? AND estado = 'activa' LIMIT 1",
        )
        .get(alumnoId, materia.id, currentYear),
    );

    const materiaAprobada = isMateriaAprobada(alumnoId, materia.id);

    let disponible = true;
    let motivo = null;
    let yaInscripto = yaInscriptoReal;

    if (!periodoDisponible) {
      disponible = false;
      motivo = "No hay un período de inscripción activo.";
    } else if (materiaAprobada) {
      disponible = false;
      yaInscripto = false;
      motivo = "Ya tenés esta materia aprobada.";
    } else if (materia.codigo === "AM1") {
      if (yaInscripto) {
        disponible = false;
        motivo = null;
      }
    } else if (materia.codigo === "AM2") {
      if (!hasAM1CursadaAprobada) {
        disponible = false;
        motivo = "Debés aprobar la cursada de AM1 antes de inscribirte en AM2.";
      } else if (yaInscripto) {
        disponible = false;
        motivo = null;
      }
    } else if (yaInscripto) {
      disponible = false;
      motivo = null;
    }

    return {
      materia_id: materia.id,
      materia_nombre: materia.nombre,
      materia_codigo: materia.codigo,
      disponible,
      motivo,
      materia_aprobada: materiaAprobada,
      ya_inscripto: yaInscripto,
      docentes: getDocentesNombresByMateriaAndYear(materia.id, currentYear),
      periodo_activo: periodoActivo
        ? {
            id: periodoActivo.id,
            descripcion: periodoActivo.descripcion,
            fecha_fin: periodoActivo.fecha_fin,
          }
        : null,
    };
  });

  return res.status(200).json(response);
});

router.post("/inscripcion", authorize("alumno"), (req, res) => {
  const alumnoId = req.user.id;
  const currentYear = new Date().getFullYear();
  const materiaId = toPositiveInt(req.body.materia_id);

  const periodoActivo = getActivePeriodo();
  if (!periodoActivo || !isPeriodoVigente(periodoActivo)) {
    return res
      .status(403)
      .json({ message: "No hay un período de inscripción activo." });
  }

  if (!materiaId) {
    return res.status(422).json({ message: "La materia es obligatoria." });
  }

  const materia = db
    .prepare("SELECT id, nombre, codigo FROM materias WHERE id = ? LIMIT 1")
    .get(materiaId);

  if (!materia) {
    return res.status(404).json({ message: "La materia no existe." });
  }

  if (isMateriaAprobada(alumnoId, materiaId)) {
    return res.status(409).json({
      message:
        "Ya tenés esta materia aprobada. No podés inscribirte nuevamente.",
    });
  }

  if (materia.codigo === "AM2") {
    const am1 = db
      .prepare("SELECT id FROM materias WHERE codigo = 'AM1' LIMIT 1")
      .get();
    const hasCorrelatividad =
      am1 &&
      db
        .prepare(
          "SELECT 1 AS ok FROM cursadas WHERE alumno_id = ? AND materia_id = ? AND estado = 'aprobada' LIMIT 1",
        )
        .get(alumnoId, am1.id);

    if (!hasCorrelatividad) {
      return res.status(403).json({
        message: "Debés aprobar la cursada de AM1 antes de inscribirte en AM2.",
      });
    }
  }

  const alreadyActive = db
    .prepare(
      "SELECT id FROM inscripciones WHERE alumno_id = ? AND materia_id = ? AND anio = ? AND estado = 'activa' LIMIT 1",
    )
    .get(alumnoId, materiaId, currentYear);

  if (alreadyActive) {
    return res.status(409).json({
      message: "Ya estás inscripto en esta materia para el año en curso.",
    });
  }

  const created = db
    .prepare(
      `
      INSERT INTO inscripciones (
        alumno_id,
        materia_id,
        anio,
        periodo_id,
        estado
      ) VALUES (?, ?, ?, ?, 'activa')
    `,
    )
    .run(alumnoId, materiaId, currentYear, periodoActivo.id);

  return res.status(201).json({
    inscripcion_id: Number(created.lastInsertRowid),
    materia_nombre: materia.nombre,
    anio: currentYear,
    periodo_descripcion: periodoActivo.descripcion,
  });
});

router.delete("/inscripcion/:materiaId", authorize("alumno"), (req, res) => {
  const alumnoId = req.user.id;
  const currentYear = new Date().getFullYear();
  const materiaId = toPositiveInt(req.params.materiaId);

  if (!materiaId) {
    return res.status(400).json({ message: "Materia inválida." });
  }

  if (isMateriaAprobada(alumnoId, materiaId)) {
    return res.status(409).json({
      message: "No podés darte de baja de una materia que ya está aprobada.",
    });
  }

  const existing = db
    .prepare(
      "SELECT id FROM inscripciones WHERE alumno_id = ? AND materia_id = ? AND anio = ? AND estado = 'activa' LIMIT 1",
    )
    .get(alumnoId, materiaId, currentYear);

  if (!existing) {
    return res
      .status(404)
      .json({ message: "No existe una inscripción activa para esa materia." });
  }

  const periodoActivo = getActivePeriodo();
  const periodoVigente = periodoActivo && isPeriodoVigente(periodoActivo);

  if (!periodoVigente) {
    return res.status(403).json({
      message: "El período de inscripción ya finalizó. No podés darte de baja.",
    });
  }

  db.prepare("UPDATE inscripciones SET estado = 'baja' WHERE id = ?").run(
    existing.id,
  );
  return res
    .status(200)
    .json({ message: "Inscripción dada de baja correctamente" });
});

module.exports = router;
