const express = require("express");
const db = require("../db/database");
const { authorize } = require("../middleware/auth.middleware");

const router = express.Router();
const TIPO_ALUMNO_TUTOR = "alumno_tutor";
const TIPO_DOCENTE_COORDINADOR = "docente_coordinador";

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function mapConversacionForResponse(item) {
  const participanteANombre =
    item.participante_a_nombre || item.participante_a_username || null;
  const participanteBNombre =
    item.participante_b_nombre || item.participante_b_username || null;

  return {
    ...item,
    tipo_conversacion: item.tipo_conversacion || TIPO_ALUMNO_TUTOR,
    participante_a_id: Number(item.participante_a_id || item.alumno_id),
    participante_b_id: Number(item.participante_b_id || item.tutor_id),
    participante_a_nombre: participanteANombre,
    participante_b_nombre: participanteBNombre,
    alumno_nombre:
      item.alumno_nombre || item.alumno_username || participanteANombre,
    tutor_nombre:
      item.tutor_nombre || item.tutor_username || participanteBNombre,
  };
}

function getParticipantIds(conversacion) {
  if (!conversacion) {
    return { participanteAId: null, participanteBId: null };
  }

  return {
    participanteAId: Number(
      conversacion.participante_a_id || conversacion.alumno_id,
    ),
    participanteBId: Number(
      conversacion.participante_b_id || conversacion.tutor_id,
    ),
  };
}

function getConversacionById(conversacionId) {
  const conversacion = db
    .prepare(
      `
      SELECT c.*,
        a.nombre_completo AS alumno_nombre,
        a.username AS alumno_username,
        t.nombre_completo AS tutor_nombre,
        t.username AS tutor_username,
        pa.nombre_completo AS participante_a_nombre,
        pa.username AS participante_a_username,
        pa.role AS participante_a_role,
        pb.nombre_completo AS participante_b_nombre,
        pb.username AS participante_b_username,
        pb.role AS participante_b_role,
        m.nombre AS materia_nombre,
        u.nombre AS unidad_nombre
      FROM conversaciones c
      LEFT JOIN users a ON c.alumno_id = a.id
      LEFT JOIN users t ON c.tutor_id = t.id
      LEFT JOIN users pa ON pa.id = COALESCE(c.participante_a_id, c.alumno_id)
      LEFT JOIN users pb ON pb.id = COALESCE(c.participante_b_id, c.tutor_id)
      JOIN materias m ON c.materia_id = m.id
      LEFT JOIN unidades u ON c.unidad_id = u.id
      WHERE c.id = ?
      LIMIT 1
    `,
    )
    .get(conversacionId);

  return conversacion ? mapConversacionForResponse(conversacion) : null;
}

function hasConversationAccess(conversacion, userId) {
  if (!conversacion) {
    return false;
  }

  const { participanteAId, participanteBId } = getParticipantIds(conversacion);
  return participanteAId === userId || participanteBId === userId;
}

router.get("/no-leidos", (req, res) => {
  const total = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM mensajes ms
      JOIN conversaciones c ON c.id = ms.conversacion_id
      WHERE (
        COALESCE(c.participante_a_id, c.alumno_id) = ?
        OR COALESCE(c.participante_b_id, c.tutor_id) = ?
      )
        AND ms.remitente_id != ?
        AND ms.leido = 0
    `,
    )
    .get(req.user.id, req.user.id, req.user.id)?.total;

  return res.status(200).json({ total: total || 0 });
});

router.get("/datos/tutores-por-materia", authorize("alumno"), (req, res) => {
  const tutoresPorMateria = db
    .prepare(
      `
      SELECT DISTINCT
        u.id AS tutor_id,
        COALESCE(u.nombre_completo, u.username) AS tutor_nombre,
        m.id AS materia_id,
        m.nombre AS materia_nombre
      FROM users u
      JOIN contenido c ON c.tutor_id = u.id
      JOIN materias m ON c.materia_id = m.id
      JOIN inscripciones i ON i.materia_id = m.id
      WHERE i.alumno_id = ?
        AND u.role = 'docente'
      ORDER BY m.nombre ASC, tutor_nombre ASC
    `,
    )
    .all(req.user.id);

  if (tutoresPorMateria.length > 0) {
    return res.status(200).json(tutoresPorMateria);
  }

  const fallback = db
    .prepare(
      `
      SELECT
        id AS tutor_id,
        COALESCE(nombre_completo, username) AS tutor_nombre
      FROM users
      WHERE role = 'docente'
      ORDER BY tutor_nombre ASC
    `,
    )
    .all()
    .map((item) => ({
      ...item,
      materia_id: null,
      materia_nombre: null,
    }));

  return res.status(200).json(fallback);
});

router.get(
  "/datos/coordinadores-por-materia",
  authorize("docente"),
  (req, res) => {
    const coordinadoresPorMateria = db
      .prepare(
        `
      SELECT DISTINCT
        u.id AS coordinador_id,
        COALESCE(u.nombre_completo, u.username) AS coordinador_nombre,
        m.id AS materia_id,
        m.nombre AS materia_nombre
      FROM docente_materia dm
      JOIN users u ON u.id = dm.asignado_por
      JOIN materias m ON m.id = dm.materia_id
      WHERE dm.docente_id = ?
        AND dm.activo = 1
        AND u.role = 'coordinador'
      ORDER BY m.nombre ASC, coordinador_nombre ASC
    `,
      )
      .all(req.user.id);

    if (coordinadoresPorMateria.length > 0) {
      return res.status(200).json(coordinadoresPorMateria);
    }

    const fallback = db
      .prepare(
        `
      SELECT
        id AS coordinador_id,
        COALESCE(nombre_completo, username) AS coordinador_nombre
      FROM users
      WHERE role = 'coordinador'
      ORDER BY coordinador_nombre ASC
    `,
      )
      .all()
      .map((item) => ({
        ...item,
        materia_id: null,
        materia_nombre: null,
      }));

    return res.status(200).json(fallback);
  },
);

router.get(
  "/datos/docentes-por-materia",
  authorize("coordinador"),
  (req, res) => {
    const docentesPorMateria = db
      .prepare(
        `
      SELECT DISTINCT
        u.id AS docente_id,
        COALESCE(u.nombre_completo, u.username) AS docente_nombre,
        m.id AS materia_id,
        m.nombre AS materia_nombre
      FROM docente_materia dm
      JOIN users u ON u.id = dm.docente_id
      JOIN materias m ON m.id = dm.materia_id
      WHERE dm.asignado_por = ?
        AND dm.activo = 1
        AND u.role = 'docente'
      ORDER BY m.nombre ASC, docente_nombre ASC
    `,
      )
      .all(req.user.id);

    if (docentesPorMateria.length > 0) {
      return res.status(200).json(docentesPorMateria);
    }

    const fallback = db
      .prepare(
        `
      SELECT
        id AS docente_id,
        COALESCE(nombre_completo, username) AS docente_nombre
      FROM users
      WHERE role = 'docente'
      ORDER BY docente_nombre ASC
    `,
      )
      .all()
      .map((item) => ({
        ...item,
        materia_id: null,
        materia_nombre: null,
      }));

    return res.status(200).json(fallback);
  },
);

router.get(
  "/datos/unidades/:materiaId",
  authorize("alumno", "docente", "coordinador"),
  (req, res) => {
    const materiaId = parsePositiveInteger(req.params.materiaId);

    if (!materiaId) {
      return res.status(400).json({ message: "Materia inválida" });
    }

    const unidades = db
      .prepare(
        "SELECT id, nombre, orden FROM unidades WHERE materia_id = ? ORDER BY orden ASC",
      )
      .all(materiaId);

    return res.status(200).json(unidades);
  },
);

router.get(
  "/datos/alumnos-por-materia/:materiaId",
  authorize("docente"),
  (req, res) => {
    const materiaId = parsePositiveInteger(req.params.materiaId);

    if (!materiaId) {
      return res.status(400).json({ message: "Materia inválida" });
    }

    const alumnos = db
      .prepare(
        `
      SELECT DISTINCT
        u.id,
        u.nombre_completo,
        u.email
      FROM inscripciones i
      JOIN users u ON u.id = i.alumno_id
      WHERE i.materia_id = ?
        AND u.role = 'alumno'
      ORDER BY COALESCE(u.nombre_completo, u.username) ASC
    `,
      )
      .all(materiaId);

    return res.status(200).json(alumnos);
  },
);

router.get("/", (req, res) => {
  const userId = req.user.id;

  const conversaciones = db
    .prepare(
      `
      SELECT c.*,
        pa.nombre_completo AS participante_a_nombre,
        pa.username AS participante_a_username,
        pa.role AS participante_a_role,
        pb.nombre_completo AS participante_b_nombre,
        pb.username AS participante_b_username,
        pb.role AS participante_b_role,
        m_alumno.nombre_completo AS alumno_nombre,
        m_alumno.username AS alumno_username,
        m_tutor.nombre_completo AS tutor_nombre,
        m_tutor.username AS tutor_username,
        mat.nombre AS materia_nombre,
        u.nombre AS unidad_nombre,
        (
          SELECT COUNT(*)
          FROM mensajes
          WHERE conversacion_id = c.id
            AND leido = 0
            AND remitente_id != ?
        ) AS no_leidos
      FROM conversaciones c
      LEFT JOIN users m_alumno ON c.alumno_id = m_alumno.id
      LEFT JOIN users m_tutor ON c.tutor_id = m_tutor.id
      JOIN users pa ON pa.id = COALESCE(c.participante_a_id, c.alumno_id)
      JOIN users pb ON pb.id = COALESCE(c.participante_b_id, c.tutor_id)
      JOIN materias mat ON c.materia_id = mat.id
      LEFT JOIN unidades u ON c.unidad_id = u.id
      WHERE COALESCE(c.participante_a_id, c.alumno_id) = ?
         OR COALESCE(c.participante_b_id, c.tutor_id) = ?
      ORDER BY c.ultimo_mensaje_at DESC
    `,
    )
    .all(userId, userId, userId)
    .map(mapConversacionForResponse);

  return res.status(200).json(conversaciones);
});

router.post("/", authorize("alumno"), (req, res) => {
  const tutorId = parsePositiveInteger(req.body.tutor_id);
  const materiaId = parsePositiveInteger(req.body.materia_id);
  const unidadId = req.body.unidad_id
    ? parsePositiveInteger(req.body.unidad_id)
    : null;
  const asunto = String(req.body.asunto || "").trim();
  const cuerpo = String(req.body.cuerpo || "").trim();

  if (!tutorId || !materiaId || !asunto || !cuerpo) {
    return res
      .status(422)
      .json({ message: "Completá todos los campos obligatorios." });
  }

  if (asunto.length > 150) {
    return res
      .status(422)
      .json({ message: "El asunto no puede superar 150 caracteres." });
  }

  if (cuerpo.length > 2000) {
    return res
      .status(422)
      .json({ message: "El mensaje no puede superar 2000 caracteres." });
  }

  const isEnrolled = db
    .prepare(
      "SELECT 1 AS ok FROM inscripciones WHERE alumno_id = ? AND materia_id = ? LIMIT 1",
    )
    .get(req.user.id, materiaId);

  if (!isEnrolled) {
    return res
      .status(403)
      .json({ message: "No estás inscripto en esta materia." });
  }

  const tutor = db
    .prepare("SELECT id FROM users WHERE id = ? AND role = 'docente' LIMIT 1")
    .get(tutorId);

  if (!tutor) {
    return res
      .status(422)
      .json({ message: "El destinatario debe ser un tutor válido." });
  }

  if (unidadId) {
    const unidad = db
      .prepare(
        "SELECT id FROM unidades WHERE id = ? AND materia_id = ? LIMIT 1",
      )
      .get(unidadId, materiaId);

    if (!unidad) {
      return res
        .status(422)
        .json({ message: "La unidad indicada no pertenece a la materia." });
    }
  }

  const createConversacion = db.transaction(() => {
    const conversacionResult = db
      .prepare(
        `
        INSERT INTO conversaciones (
          asunto,
          alumno_id,
          tutor_id,
          materia_id,
          unidad_id,
          participante_a_id,
          participante_b_id,
          tipo_conversacion,
          ultimo_mensaje_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      )
      .run(
        asunto,
        req.user.id,
        tutorId,
        materiaId,
        unidadId,
        req.user.id,
        tutorId,
        TIPO_ALUMNO_TUTOR,
      );

    const conversacionId = Number(conversacionResult.lastInsertRowid);

    const mensajeResult = db
      .prepare(
        `
        INSERT INTO mensajes (
          conversacion_id,
          remitente_id,
          cuerpo,
          leido
        ) VALUES (?, ?, ?, 0)
      `,
      )
      .run(conversacionId, req.user.id, cuerpo);

    return {
      conversacion_id: conversacionId,
      mensaje_id: Number(mensajeResult.lastInsertRowid),
    };
  });

  const created = createConversacion();
  return res.status(201).json(created);
});

router.post("/tutor/nuevo", authorize("docente"), (req, res) => {
  const alumnoId = parsePositiveInteger(req.body.alumno_id);
  const materiaId = parsePositiveInteger(req.body.materia_id);
  const unidadId = req.body.unidad_id
    ? parsePositiveInteger(req.body.unidad_id)
    : null;
  const asunto = String(req.body.asunto || "").trim();
  const cuerpo = String(req.body.cuerpo || "").trim();

  if (!alumnoId || !materiaId || !asunto || !cuerpo) {
    return res
      .status(422)
      .json({ message: "Completá todos los campos obligatorios." });
  }

  if (asunto.length > 150) {
    return res
      .status(422)
      .json({ message: "El asunto no puede superar 150 caracteres." });
  }

  if (cuerpo.length > 2000) {
    return res
      .status(422)
      .json({ message: "El mensaje no puede superar 2000 caracteres." });
  }

  const alumno = db
    .prepare("SELECT id FROM users WHERE id = ? AND role = 'alumno' LIMIT 1")
    .get(alumnoId);

  if (!alumno) {
    return res
      .status(422)
      .json({ message: "El destinatario debe ser un alumno válido." });
  }

  const isEnrolled = db
    .prepare(
      "SELECT 1 AS ok FROM inscripciones WHERE alumno_id = ? AND materia_id = ? LIMIT 1",
    )
    .get(alumnoId, materiaId);

  if (!isEnrolled) {
    return res
      .status(403)
      .json({ message: "El alumno no está inscripto en esta materia." });
  }

  if (unidadId) {
    const unidad = db
      .prepare(
        "SELECT id FROM unidades WHERE id = ? AND materia_id = ? LIMIT 1",
      )
      .get(unidadId, materiaId);

    if (!unidad) {
      return res
        .status(422)
        .json({ message: "La unidad indicada no pertenece a la materia." });
    }
  }

  const createConversacion = db.transaction(() => {
    const conversacionResult = db
      .prepare(
        `
        INSERT INTO conversaciones (
          asunto,
          alumno_id,
          tutor_id,
          materia_id,
          unidad_id,
          participante_a_id,
          participante_b_id,
          tipo_conversacion,
          ultimo_mensaje_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      )
      .run(
        asunto,
        alumnoId,
        req.user.id,
        materiaId,
        unidadId,
        alumnoId,
        req.user.id,
        TIPO_ALUMNO_TUTOR,
      );

    const conversacionId = Number(conversacionResult.lastInsertRowid);

    const mensajeResult = db
      .prepare(
        `
        INSERT INTO mensajes (
          conversacion_id,
          remitente_id,
          cuerpo,
          leido
        ) VALUES (?, ?, ?, 0)
      `,
      )
      .run(conversacionId, req.user.id, cuerpo);

    return {
      conversacion_id: conversacionId,
      mensaje_id: Number(mensajeResult.lastInsertRowid),
    };
  });

  const created = createConversacion();
  return res.status(201).json(created);
});

router.post(
  "/docente-coordinador",
  authorize("docente", "coordinador"),
  (req, res) => {
    const materiaId = parsePositiveInteger(req.body.materia_id);
    const unidadId = req.body.unidad_id
      ? parsePositiveInteger(req.body.unidad_id)
      : null;
    const destinatarioId = parsePositiveInteger(
      req.body.destinatario_id ||
        req.body.coordinador_id ||
        req.body.docente_id,
    );
    const asunto = String(req.body.asunto || "").trim();
    const cuerpo = String(req.body.cuerpo || "").trim();

    if (!destinatarioId || !materiaId || !asunto || !cuerpo) {
      return res
        .status(422)
        .json({ message: "Completá todos los campos obligatorios." });
    }

    if (asunto.length > 150) {
      return res
        .status(422)
        .json({ message: "El asunto no puede superar 150 caracteres." });
    }

    if (cuerpo.length > 2000) {
      return res
        .status(422)
        .json({ message: "El mensaje no puede superar 2000 caracteres." });
    }

    if (unidadId) {
      const unidad = db
        .prepare(
          "SELECT id FROM unidades WHERE id = ? AND materia_id = ? LIMIT 1",
        )
        .get(unidadId, materiaId);

      if (!unidad) {
        return res
          .status(422)
          .json({ message: "La unidad indicada no pertenece a la materia." });
      }
    }

    const remitenteId = req.user.id;
    const remitenteRole = req.user.role;

    const destinatario = db
      .prepare("SELECT id, role FROM users WHERE id = ? LIMIT 1")
      .get(destinatarioId);

    if (!destinatario) {
      return res.status(422).json({ message: "Destinatario inválido." });
    }

    if (remitenteRole === "docente") {
      if (destinatario.role !== "coordinador") {
        return res
          .status(422)
          .json({ message: "El destinatario debe ser un coordinador." });
      }

      const docenteAsignado = db
        .prepare(
          `
          SELECT 1 AS ok
          FROM docente_materia dm
          WHERE dm.docente_id = ?
            AND dm.materia_id = ?
            AND dm.activo = 1
          LIMIT 1
        `,
        )
        .get(remitenteId, materiaId);

      if (!docenteAsignado) {
        return res.status(403).json({
          message:
            "No tenés asignación activa en la materia seleccionada para iniciar esta conversación.",
        });
      }
    }

    if (remitenteRole === "coordinador") {
      if (destinatario.role !== "docente") {
        return res
          .status(422)
          .json({ message: "El destinatario debe ser un docente." });
      }

      const puedeContactar = db
        .prepare(
          `
          SELECT 1 AS ok
          FROM docente_materia dm
          WHERE dm.docente_id = ?
            AND dm.materia_id = ?
            AND dm.asignado_por = ?
            AND dm.activo = 1
          LIMIT 1
        `,
        )
        .get(destinatarioId, materiaId, remitenteId);

      if (!puedeContactar) {
        return res.status(403).json({
          message:
            "Solo podés iniciar conversaciones con docentes asignados por vos en esa materia.",
        });
      }
    }

    const createConversacion = db.transaction(() => {
      const conversacionResult = db
        .prepare(
          `
          INSERT INTO conversaciones (
            asunto,
            alumno_id,
            tutor_id,
            materia_id,
            unidad_id,
            participante_a_id,
            participante_b_id,
            tipo_conversacion,
            ultimo_mensaje_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        )
        .run(
          asunto,
          remitenteId,
          destinatarioId,
          materiaId,
          unidadId,
          remitenteId,
          destinatarioId,
          TIPO_DOCENTE_COORDINADOR,
        );

      const conversacionId = Number(conversacionResult.lastInsertRowid);

      const mensajeResult = db
        .prepare(
          `
          INSERT INTO mensajes (
            conversacion_id,
            remitente_id,
            cuerpo,
            leido
          ) VALUES (?, ?, ?, 0)
        `,
        )
        .run(conversacionId, remitenteId, cuerpo);

      return {
        conversacion_id: conversacionId,
        mensaje_id: Number(mensajeResult.lastInsertRowid),
      };
    });

    const created = createConversacion();
    return res.status(201).json(created);
  },
);

router.get("/:conversacionId", (req, res) => {
  const conversacionId = parsePositiveInteger(req.params.conversacionId);

  if (!conversacionId) {
    return res.status(400).json({ message: "Conversación inválida" });
  }

  const conversacion = getConversacionById(conversacionId);

  if (!hasConversationAccess(conversacion, req.user.id)) {
    return res
      .status(403)
      .json({ message: "No tenés acceso a esta conversación." });
  }

  db.prepare(
    `
    UPDATE mensajes
    SET leido = 1
    WHERE conversacion_id = ?
      AND remitente_id != ?
      AND leido = 0
  `,
  ).run(conversacionId, req.user.id);

  const mensajes = db
    .prepare(
      `
      SELECT ms.*, 
        u.nombre_completo AS remitente_nombre,
        u.username AS remitente_username,
        u.role AS remitente_role
      FROM mensajes ms
      JOIN users u ON ms.remitente_id = u.id
      WHERE ms.conversacion_id = ?
      ORDER BY ms.created_at ASC
    `,
    )
    .all(conversacionId)
    .map((item) => ({
      ...item,
      remitente_nombre: item.remitente_nombre || item.remitente_username,
    }));

  return res.status(200).json({
    conversacion,
    mensajes,
  });
});

router.post("/:conversacionId/responder", (req, res) => {
  const conversacionId = parsePositiveInteger(req.params.conversacionId);
  const cuerpo = String(req.body.cuerpo || "").trim();

  if (!conversacionId) {
    return res.status(400).json({ message: "Conversación inválida" });
  }

  if (!cuerpo) {
    return res
      .status(422)
      .json({ message: "El mensaje no puede estar vacío." });
  }

  if (cuerpo.length > 2000) {
    return res
      .status(422)
      .json({ message: "El mensaje no puede superar 2000 caracteres." });
  }

  const conversacion = getConversacionById(conversacionId);

  if (!hasConversationAccess(conversacion, req.user.id)) {
    return res
      .status(403)
      .json({ message: "No tenés acceso a esta conversación." });
  }

  const created = db.transaction(() => {
    const insertResult = db
      .prepare(
        `
        INSERT INTO mensajes (
          conversacion_id,
          remitente_id,
          cuerpo,
          leido
        ) VALUES (?, ?, ?, 0)
      `,
      )
      .run(conversacionId, req.user.id, cuerpo);

    db.prepare(
      "UPDATE conversaciones SET ultimo_mensaje_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(conversacionId);

    return db
      .prepare(
        `
        SELECT ms.*, 
          u.nombre_completo AS remitente_nombre,
          u.username AS remitente_username,
          u.role AS remitente_role
        FROM mensajes ms
        JOIN users u ON ms.remitente_id = u.id
        WHERE ms.id = ?
      `,
      )
      .get(insertResult.lastInsertRowid);
  })();

  return res.status(201).json({
    ...created,
    remitente_nombre: created.remitente_nombre || created.remitente_username,
  });
});

module.exports = router;
