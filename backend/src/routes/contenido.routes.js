const fs = require("fs");
const path = require("path");
const express = require("express");
const db = require("../db/database");
const { authorize } = require("../middleware/auth.middleware");
const { upload, resolvedUploadsPath } = require("../config/storage");

const router = express.Router();
const uploadsBaseUrl =
  process.env.UPLOADS_BASE_URL || "http://localhost:3001/uploads";

function normalizeArchivoPath(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).replace(/\\/g, "/").trim();

  if (!normalized || normalized.includes("..")) {
    return null;
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function toArchivoUrl(archivoPath) {
  const normalized = normalizeArchivoPath(archivoPath);

  if (!normalized || normalized.startsWith("/sample/")) {
    return null;
  }

  return `${uploadsBaseUrl}${normalized}`;
}

function isValidVideoUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace("www.", "").toLowerCase();

    if (hostname === "youtube.com") {
      return parsed.pathname === "/watch" && parsed.searchParams.has("v");
    }

    if (hostname === "youtu.be") {
      return parsed.pathname.length > 1;
    }

    if (hostname === "vimeo.com") {
      return /^\/[0-9]+$/.test(parsed.pathname);
    }

    return false;
  } catch {
    return false;
  }
}

function fileMatchesTipo(file, tipo) {
  if (!file || !file.originalname) {
    return false;
  }

  const extension = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();

  if (tipo === "pdf") {
    return extension === ".pdf" && mime.includes("pdf");
  }

  if (tipo === "word") {
    return (
      [".doc", ".docx"].includes(extension) &&
      (mime.includes("msword") ||
        mime.includes("officedocument.wordprocessingml") ||
        mime.includes("application/octet-stream"))
    );
  }

  if (tipo === "imagen") {
    return (
      [".jpg", ".jpeg", ".png", ".gif"].includes(extension) &&
      mime.startsWith("image/")
    );
  }

  return false;
}

function isAlumnoInMateria(alumnoId, materiaId) {
  const row = db
    .prepare(
      "SELECT 1 AS ok FROM inscripciones WHERE alumno_id = ? AND materia_id = ? LIMIT 1",
    )
    .get(alumnoId, materiaId);

  return Boolean(row?.ok);
}

function hasDocenteAsignacionActiva(docenteId, materiaId) {
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

router.get("/materias", authorize("alumno"), (req, res) => {
  const materias = db
    .prepare(
      `
      SELECT m.id, m.nombre, m.codigo, m.descripcion
      FROM materias m
      JOIN inscripciones i ON m.id = i.materia_id
      WHERE i.alumno_id = ?
      ORDER BY m.nombre ASC
    `,
    )
    .all(req.user.id);

  return res.status(200).json(materias);
});

router.get("/materias/:materiaId", authorize("alumno"), (req, res) => {
  const materiaId = Number(req.params.materiaId);

  if (!Number.isInteger(materiaId) || materiaId <= 0) {
    return res.status(400).json({ message: "Materia inválida" });
  }

  if (!isAlumnoInMateria(req.user.id, materiaId)) {
    return res.status(403).json({ message: "No tenés acceso a esta materia." });
  }

  const materia = db
    .prepare("SELECT id, nombre, codigo FROM materias WHERE id = ?")
    .get(materiaId);

  const items = db
    .prepare(
      `
      SELECT
        c.id,
        c.titulo,
        c.descripcion,
        c.tipo,
        c.archivo_path,
        c.video_url,
        c.alumno_id,
        c.created_at,
        u.nombre_completo AS tutor_nombre,
        u.username AS tutor_username
      FROM contenido c
      JOIN users u ON u.id = c.tutor_id
      WHERE c.materia_id = ?
        AND (c.alumno_id IS NULL OR c.alumno_id = ?)
      ORDER BY c.created_at DESC
    `,
    )
    .all(materiaId, req.user.id)
    .map((item) => ({
      id: item.id,
      titulo: item.titulo,
      descripcion: item.descripcion,
      tipo: item.tipo,
      archivo_url: toArchivoUrl(item.archivo_path),
      video_url: item.video_url,
      alumno_id: item.alumno_id,
      created_at: item.created_at,
      tutor_nombre: item.tutor_nombre || item.tutor_username || "Tutor",
    }));

  return res.status(200).json({ materia, items });
});

router.get("/tutor/materias", authorize("docente", "admin"), (req, res) => {
  const materias = db
    .prepare("SELECT id, nombre, codigo FROM materias ORDER BY nombre ASC")
    .all();

  return res.status(200).json(materias);
});

router.get("/docente/mis-materias", authorize("docente"), (req, res) => {
  const materias = db
    .prepare(
      `
      SELECT m.id, m.nombre, m.codigo, m.descripcion
      FROM materias m
      JOIN docente_materia dm ON dm.materia_id = m.id
      WHERE dm.docente_id = ? AND dm.activo = 1
      ORDER BY m.nombre ASC
    `,
    )
    .all(req.user.id);

  return res.status(200).json(materias);
});

router.get("/docente/materia/:materiaId", authorize("docente"), (req, res) => {
  const materiaId = Number(req.params.materiaId);

  if (!Number.isInteger(materiaId) || materiaId <= 0) {
    return res.status(400).json({ message: "Materia inválida." });
  }

  if (!hasDocenteAsignacionActiva(req.user.id, materiaId)) {
    return res
      .status(403)
      .json({ message: "No tenés una asignación activa en esta materia." });
  }

  const materia = db
    .prepare("SELECT id, nombre, codigo FROM materias WHERE id = ? LIMIT 1")
    .get(materiaId);

  const items = db
    .prepare(
      `
      SELECT
        c.*,
        u_subio.nombre_completo AS subido_por_nombre,
        u_subio.username AS subido_por_username,
        u_subio.role AS subido_por_rol,
        u_alumno.nombre_completo AS alumno_destinatario_nombre,
        u_alumno.username AS alumno_destinatario_username
      FROM contenido c
      JOIN users u_subio ON c.tutor_id = u_subio.id
      LEFT JOIN users u_alumno ON c.alumno_id = u_alumno.id
      WHERE c.materia_id = ?
      ORDER BY c.created_at DESC
    `,
    )
    .all(materiaId)
    .map((item) => ({
      id: item.id,
      titulo: item.titulo,
      descripcion: item.descripcion,
      tipo: item.tipo,
      archivo_url: toArchivoUrl(item.archivo_path),
      video_url: item.video_url,
      alumno_id: item.alumno_id,
      alumno_destinatario_nombre:
        item.alumno_destinatario_nombre ||
        item.alumno_destinatario_username ||
        null,
      subido_por_nombre:
        item.subido_por_nombre || item.subido_por_username || "Usuario",
      subido_por_rol: item.subido_por_rol,
      es_propio: Number(item.tutor_id) === Number(req.user.id),
      created_at: item.created_at,
    }));

  return res.status(200).json({ materia, items });
});

router.get("/docente/:contenidoId", authorize("docente"), (req, res) => {
  const contenidoId = Number(req.params.contenidoId);

  if (!Number.isInteger(contenidoId) || contenidoId <= 0) {
    return res.status(400).json({ message: "Contenido inválido." });
  }

  const row = db
    .prepare(
      `
      SELECT
        c.*,
        m.id AS materia_id,
        m.nombre AS materia_nombre,
        m.codigo AS materia_codigo,
        u_subio.nombre_completo AS subido_por_nombre,
        u_subio.username AS subido_por_username,
        u_subio.role AS subido_por_rol,
        u_alumno.nombre_completo AS alumno_destinatario_nombre,
        u_alumno.username AS alumno_destinatario_username
      FROM contenido c
      JOIN materias m ON m.id = c.materia_id
      JOIN users u_subio ON u_subio.id = c.tutor_id
      LEFT JOIN users u_alumno ON u_alumno.id = c.alumno_id
      WHERE c.id = ?
      LIMIT 1
    `,
    )
    .get(contenidoId);

  if (!row) {
    return res.status(404).json({ message: "Contenido no encontrado." });
  }

  if (!hasDocenteAsignacionActiva(req.user.id, row.materia_id)) {
    return res
      .status(403)
      .json({ message: "No tenés una asignación activa en esta materia." });
  }

  return res.status(200).json({
    ...row,
    archivo_url: toArchivoUrl(row.archivo_path),
    subido_por_nombre:
      row.subido_por_nombre || row.subido_por_username || "Usuario",
    subido_por_rol: row.subido_por_rol,
    alumno_destinatario_nombre:
      row.alumno_destinatario_nombre ||
      row.alumno_destinatario_username ||
      null,
    es_propio: Number(row.tutor_id) === Number(req.user.id),
    materia: {
      id: row.materia_id,
      nombre: row.materia_nombre,
      codigo: row.materia_codigo,
    },
  });
});

router.get("/tutor/alumnos", authorize("docente", "admin"), (req, res) => {
  const alumnos = db
    .prepare(
      `
      SELECT id, username, nombre_completo, email
      FROM users
      WHERE role = 'alumno'
      ORDER BY COALESCE(nombre_completo, username) ASC
    `,
    )
    .all()
    .map((alumno) => ({
      id: alumno.id,
      nombre: alumno.nombre_completo || alumno.username,
      email: alumno.email || null,
    }));

  return res.status(200).json(alumnos);
});

router.get(
  "/tutor/mis-contenidos",
  authorize("docente", "admin"),
  (req, res) => {
    const rows = db
      .prepare(
        `
      SELECT
        c.id,
        c.titulo,
        c.tipo,
        c.alumno_id,
        c.created_at,
        m.nombre AS materia_nombre,
        u.nombre_completo AS alumno_nombre,
        u.username AS alumno_username
      FROM contenido c
      JOIN materias m ON m.id = c.materia_id
      LEFT JOIN users u ON u.id = c.alumno_id
      WHERE c.tutor_id = ?
      ORDER BY c.created_at DESC
    `,
      )
      .all(req.user.id)
      .map((item) => ({
        id: item.id,
        titulo: item.titulo,
        tipo: item.tipo,
        materia_nombre: item.materia_nombre,
        alumno_id: item.alumno_id,
        alumno_nombre: item.alumno_nombre || item.alumno_username || null,
        created_at: item.created_at,
      }));

    return res.status(200).json(rows);
  },
);

router.post(
  "/",
  authorize("coordinador", "docente", "admin"),
  (req, res, next) => {
    upload.single("archivo")(req, res, (error) => {
      if (error) {
        const status =
          error.message === "Tipo de archivo no permitido" ? 422 : 400;
        return res.status(status).json({ message: error.message });
      }

      return next();
    });
  },
  (req, res) => {
    const {
      titulo,
      descripcion,
      tipo,
      materia_id: rawMateriaId,
      destinatario,
      alumno_id: rawAlumnoId,
      video_url: videoUrl,
      texto_contenido: textoContenido,
    } = req.body;

    const materiaId = Number(rawMateriaId);
    const alumnoId = rawAlumnoId ? Number(rawAlumnoId) : null;

    if (!titulo || !String(titulo).trim()) {
      return res.status(422).json({ message: "El título es obligatorio." });
    }

    if (!Number.isInteger(materiaId) || materiaId <= 0) {
      return res.status(422).json({ message: "Materia inválida." });
    }

    if (!["pdf", "word", "video", "imagen", "texto"].includes(tipo)) {
      return res.status(422).json({ message: "Tipo de contenido inválido." });
    }

    if (!["todos", "individual"].includes(destinatario)) {
      return res.status(422).json({ message: "Destinatario inválido." });
    }

    if (
      destinatario === "individual" &&
      (!Number.isInteger(alumnoId) || alumnoId <= 0)
    ) {
      return res
        .status(422)
        .json({ message: "Debés indicar un alumno destinatario." });
    }

    if (tipo === "video" && !isValidVideoUrl(videoUrl)) {
      return res.status(422).json({
        message:
          "La URL de video debe ser de YouTube o Vimeo y tener formato válido.",
      });
    }

    if (tipo === "texto" && !String(textoContenido || "").trim()) {
      return res
        .status(422)
        .json({ message: "El texto del contenido es obligatorio." });
    }

    const requiresFile = ["pdf", "word", "imagen"].includes(tipo);

    if (requiresFile && !req.file) {
      return res.status(422).json({
        message: "Debés adjuntar un archivo para este tipo de contenido.",
      });
    }

    if (requiresFile && req.file && !fileMatchesTipo(req.file, tipo)) {
      return res.status(422).json({
        message: "El tipo declarado no coincide con el archivo subido.",
      });
    }

    if (!db.prepare("SELECT id FROM materias WHERE id = ?").get(materiaId)) {
      return res
        .status(422)
        .json({ message: "La materia indicada no existe." });
    }

    if (
      req.user.role === "docente" &&
      !hasDocenteAsignacionActiva(req.user.id, materiaId)
    ) {
      return res
        .status(403)
        .json({ message: "No tenés una asignación activa en esta materia." });
    }

    if (destinatario === "individual") {
      const alumno = db
        .prepare("SELECT id, role FROM users WHERE id = ?")
        .get(alumnoId);

      if (!alumno || alumno.role !== "alumno") {
        return res
          .status(422)
          .json({ message: "El destinatario debe ser un alumno válido." });
      }
    }

    const relativePath = req.file ? `/${req.file.filename}` : null;

    const insertResult = db
      .prepare(
        `
      INSERT INTO contenido (
        tutor_id,
        materia_id,
        titulo,
        descripcion,
        tipo,
        archivo_path,
        video_url,
        texto_contenido,
        alumno_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        req.user.id,
        materiaId,
        String(titulo).trim(),
        descripcion ? String(descripcion).trim() : null,
        tipo,
        relativePath,
        tipo === "video" ? String(videoUrl).trim() : null,
        tipo === "texto" ? String(textoContenido).trim() : null,
        destinatario === "individual" ? alumnoId : null,
      );

    const created = db
      .prepare("SELECT * FROM contenido WHERE id = ?")
      .get(insertResult.lastInsertRowid);

    return res.status(201).json({
      ...created,
      archivo_url: toArchivoUrl(created.archivo_path),
    });
  },
);

router.delete("/:contenidoId", authorize("docente", "admin"), (req, res) => {
  const contenidoId = Number(req.params.contenidoId);

  if (!Number.isInteger(contenidoId) || contenidoId <= 0) {
    return res.status(400).json({ message: "Contenido inválido" });
  }

  const existing = db
    .prepare("SELECT id, tutor_id, archivo_path FROM contenido WHERE id = ?")
    .get(contenidoId);

  if (!existing) {
    return res.status(404).json({ message: "Contenido no encontrado" });
  }

  if (req.user.role !== "admin" && existing.tutor_id !== req.user.id) {
    return res
      .status(403)
      .json({
        message: "Solo podés eliminar contenido que vos mismo subiste.",
      });
  }

  const normalizedPath = normalizeArchivoPath(existing.archivo_path);

  if (normalizedPath) {
    const absoluteFilePath = path.join(
      resolvedUploadsPath,
      normalizedPath.replace(/^\//, ""),
    );

    if (
      absoluteFilePath.startsWith(resolvedUploadsPath) &&
      fs.existsSync(absoluteFilePath)
    ) {
      fs.unlinkSync(absoluteFilePath);
    }
  }

  db.prepare("DELETE FROM contenido WHERE id = ?").run(contenidoId);

  return res.status(204).send();
});

router.get("/:contenidoId", authorize("alumno"), (req, res) => {
  const contenidoId = Number(req.params.contenidoId);

  if (!Number.isInteger(contenidoId) || contenidoId <= 0) {
    return res.status(400).json({ message: "Contenido inválido" });
  }

  const row = db
    .prepare(
      `
      SELECT
        c.*,
        m.nombre AS materia_nombre,
        m.codigo AS materia_codigo,
        u.nombre_completo AS tutor_nombre,
        u.username AS tutor_username
      FROM contenido c
      JOIN materias m ON m.id = c.materia_id
      JOIN users u ON u.id = c.tutor_id
      WHERE c.id = ?
      LIMIT 1
    `,
    )
    .get(contenidoId);

  if (!row) {
    return res.status(404).json({ message: "Contenido no encontrado" });
  }

  if (!isAlumnoInMateria(req.user.id, row.materia_id)) {
    return res.status(403).json({ message: "No tenés acceso a esta materia." });
  }

  if (row.alumno_id !== null && row.alumno_id !== req.user.id) {
    return res
      .status(403)
      .json({ message: "No tenés acceso a este contenido." });
  }

  db.prepare(
    "INSERT INTO visualizaciones (alumno_id, contenido_id, visto_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
  ).run(req.user.id, contenidoId);

  return res.status(200).json({
    ...row,
    archivo_url: toArchivoUrl(row.archivo_path),
    tutor_nombre: row.tutor_nombre || row.tutor_username || "Tutor",
    materia: {
      id: row.materia_id,
      nombre: row.materia_nombre,
      codigo: row.materia_codigo,
    },
  });
});

module.exports = router;
