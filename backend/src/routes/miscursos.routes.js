const express = require("express");
const db = require("../db/database");

const router = express.Router();

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

router.get("/", (req, res) => {
  const alumnoId = req.user.id;
  const currentYear = new Date().getFullYear();

  const materias = db
    .prepare(
      `
      SELECT
        m.id AS materia_id,
        m.nombre AS materia_nombre,
        m.codigo AS materia_codigo,
        COUNT(c.id) AS veces_cursada,
        MAX(c.anio) AS ultimo_anio,
        (
          SELECT asistencia
          FROM cursadas
          WHERE alumno_id = ? AND materia_id = m.id
          ORDER BY anio DESC, id DESC
          LIMIT 1
        ) AS ultima_asistencia,
        (
          SELECT AVG(nota)
          FROM examenes
          WHERE alumno_id = ?
            AND materia_id = m.id
            AND rendido = 1
            AND nota IS NOT NULL
        ) AS promedio_notas,
        (
          SELECT COUNT(*)
          FROM examenes
          WHERE alumno_id = ?
            AND materia_id = m.id
            AND tipo = 'Final'
            AND nota >= 4
            AND rendido = 1
        ) > 0 AS tiene_final_aprobado,
        (
          SELECT anio
          FROM cursadas
          WHERE alumno_id = ?
            AND materia_id = m.id
            AND estado = 'cursando'
          ORDER BY anio DESC, id DESC
          LIMIT 1
        ) AS anio_cursada_desde_cursadas,
        (
          SELECT anio
          FROM inscripciones
          WHERE alumno_id = ?
            AND materia_id = m.id
            AND anio = ?
            AND estado = 'activa'
          ORDER BY id DESC
          LIMIT 1
        ) AS anio_inscripcion_activa
      FROM materias m
      LEFT JOIN cursadas c ON c.materia_id = m.id AND c.alumno_id = ?
      WHERE
        EXISTS (
          SELECT 1
          FROM cursadas cx
          WHERE cx.alumno_id = ? AND cx.materia_id = m.id
        )
        OR EXISTS (
          SELECT 1
          FROM inscripciones ix
          WHERE ix.alumno_id = ?
            AND ix.materia_id = m.id
            AND ix.anio = ?
            AND ix.estado = 'activa'
        )
      GROUP BY m.id
      ORDER BY m.nombre ASC
    `,
    )
    .all(
      alumnoId,
      alumnoId,
      alumnoId,
      alumnoId,
      alumnoId,
      currentYear,
      alumnoId,
      alumnoId,
      alumnoId,
      currentYear,
    )
    .map((item) => ({
      ...item,
      veces_cursada: Number(item.veces_cursada || 0),
      ultimo_anio: item.ultimo_anio ? Number(item.ultimo_anio) : null,
      ultima_asistencia:
        item.ultima_asistencia === null || item.ultima_asistencia === undefined
          ? null
          : Number(item.ultima_asistencia),
      promedio_notas:
        item.promedio_notas === null || item.promedio_notas === undefined
          ? null
          : Number(item.promedio_notas),
      tiene_final_aprobado: Boolean(item.tiene_final_aprobado),
      anio_cursada_actual: item.anio_cursada_desde_cursadas
        ? Number(item.anio_cursada_desde_cursadas)
        : item.anio_inscripcion_activa
          ? Number(item.anio_inscripcion_activa)
          : null,
    }));

  const cursando = materias.filter((item) => item.anio_cursada_actual !== null);
  const finalesPendientes = materias.filter(
    (item) =>
      !item.tiene_final_aprobado &&
      item.anio_cursada_actual === null &&
      item.veces_cursada > 0,
  );
  const aprobadas = materias.filter((item) => item.tiene_final_aprobado);
  const recursadas = materias.filter((item) => item.veces_cursada > 1);

  return res.status(200).json({
    cursando,
    finalesPendientes,
    aprobadas,
    recursadas,
  });
});

router.get("/:materiaId", (req, res) => {
  const alumnoId = req.user.id;
  const currentYear = new Date().getFullYear();
  const materiaId = parsePositiveInteger(req.params.materiaId);

  if (!materiaId) {
    return res.status(400).json({ message: "Materia inválida." });
  }

  const hasAccess = db
    .prepare(
      `
      SELECT 1 AS ok
      FROM cursadas
      WHERE alumno_id = ? AND materia_id = ?
      UNION
      SELECT 1 AS ok
      FROM inscripciones
      WHERE alumno_id = ?
        AND materia_id = ?
        AND anio = ?
        AND estado = 'activa'
      LIMIT 1
    `,
    )
    .get(alumnoId, materiaId, alumnoId, materiaId, currentYear);

  if (!hasAccess) {
    return res.status(403).json({ message: "No tenés acceso a esta materia." });
  }

  const materia = db
    .prepare(
      "SELECT id, nombre, codigo, descripcion FROM materias WHERE id = ? LIMIT 1",
    )
    .get(materiaId);

  const resumenRaw = db
    .prepare(
      `
      SELECT
        COUNT(*) AS veces_cursada,
        (
          SELECT asistencia
          FROM cursadas
          WHERE alumno_id = ? AND materia_id = ?
          ORDER BY anio DESC, id DESC
          LIMIT 1
        ) AS ultima_asistencia,
        (
          SELECT AVG(nota)
          FROM examenes
          WHERE alumno_id = ? AND materia_id = ?
            AND rendido = 1 AND nota IS NOT NULL
        ) AS promedio_notas,
        (
          SELECT COUNT(*)
          FROM examenes
          WHERE alumno_id = ? AND materia_id = ?
            AND tipo = 'Final' AND nota >= 4 AND rendido = 1
        ) > 0 AS tiene_final_aprobado
      FROM cursadas
      WHERE alumno_id = ? AND materia_id = ?
    `,
    )
    .get(
      alumnoId,
      materiaId,
      alumnoId,
      materiaId,
      alumnoId,
      materiaId,
      alumnoId,
      materiaId,
    );

  const cursadasRaw = db
    .prepare(
      `
      SELECT id, anio, asistencia, estado
      FROM cursadas
      WHERE alumno_id = ? AND materia_id = ?
      ORDER BY anio DESC, id DESC
    `,
    )
    .all(alumnoId, materiaId);

  const examenesByAnio = db
    .prepare(
      `
      SELECT anio, tipo, instancia, nota, rendido
      FROM examenes
      WHERE alumno_id = ? AND materia_id = ?
      ORDER BY
        anio DESC,
        CASE tipo
          WHEN 'Parcial' THEN 1
          WHEN 'Recuperatorio' THEN 2
          WHEN 'Final' THEN 3
          ELSE 4
        END ASC,
        instancia ASC
    `,
    )
    .all(alumnoId, materiaId)
    .reduce((acc, examen) => {
      const key = String(examen.anio);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push({
        tipo: examen.tipo,
        instancia: examen.instancia,
        nota: examen.nota,
        rendido: examen.rendido,
      });
      return acc;
    }, {});

  const cursadas = cursadasRaw.map((cursada) => ({
    anio: cursada.anio,
    asistencia: cursada.asistencia,
    estado: cursada.estado,
    examenes: examenesByAnio[String(cursada.anio)] || [],
  }));

  return res.status(200).json({
    materia,
    resumen: {
      veces_cursada: Number(resumenRaw.veces_cursada || 0),
      tiene_final_aprobado: Boolean(resumenRaw.tiene_final_aprobado),
      promedio_notas:
        resumenRaw.promedio_notas === null ||
        resumenRaw.promedio_notas === undefined
          ? null
          : Number(resumenRaw.promedio_notas),
      ultima_asistencia:
        resumenRaw.ultima_asistencia === null ||
        resumenRaw.ultima_asistencia === undefined
          ? null
          : Number(resumenRaw.ultima_asistencia),
    },
    cursadas,
  });
});

module.exports = router;
