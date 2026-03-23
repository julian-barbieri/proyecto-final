const fs = require("fs");
const path = require("path");
const express = require("express");
const db = require("../db/database");
const { authorize } = require("../middleware/auth.middleware");
const { upload, resolvedUploadsPath } = require("../config/storage");

const router = express.Router();
const uploadsBaseUrl =
  process.env.UPLOADS_BASE_URL || "http://localhost:3001/uploads";

const extensionToTipo = {
  ".pdf": "pdf",
  ".doc": "word",
  ".docx": "word",
  ".jpg": "imagen",
  ".jpeg": "imagen",
  ".png": "imagen",
  ".gif": "imagen",
  ".txt": "texto",
};

router.use(authorize("admin", "coordinador"));

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

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
  if (!normalized) {
    return null;
  }

  return `${uploadsBaseUrl}${normalized}`;
}

function toDiskRelativePath(archivoPath) {
  const normalized = normalizeArchivoPath(archivoPath);

  if (!normalized) {
    return null;
  }

  return normalized.replace(/^\/+/, "");
}

function getCarpetaById(carpetaId) {
  return db
    .prepare(
      `
      SELECT c.id, c.materia_id, c.nombre, c.creado_por, c.created_at,
        COALESCE(u.nombre_completo, u.username) AS creado_por_nombre
      FROM carpetas c
      JOIN users u ON u.id = c.creado_por
      WHERE c.id = ?
      LIMIT 1
    `,
    )
    .get(carpetaId);
}

router.get("/materias", (req, res) => {
  const materias = db
    .prepare(
      `
      SELECT m.id, m.nombre, m.codigo,
        COUNT(c.id) AS total_carpetas
      FROM materias m
      LEFT JOIN carpetas c ON c.materia_id = m.id
      GROUP BY m.id
      ORDER BY m.nombre ASC
    `,
    )
    .all();

  return res.status(200).json(materias);
});

router.get("/materias/:materiaId/carpetas", (req, res) => {
  const materiaId = parsePositiveInteger(req.params.materiaId);

  if (!materiaId) {
    return res.status(400).json({ message: "Materia inválida." });
  }

  const materia = db
    .prepare("SELECT id FROM materias WHERE id = ? LIMIT 1")
    .get(materiaId);

  if (!materia) {
    return res.status(404).json({ message: "La materia no existe." });
  }

  const carpetas = db
    .prepare(
      `
      SELECT ca.id, ca.materia_id, ca.nombre, ca.creado_por, ca.created_at,
        COALESCE(u.nombre_completo, u.username) AS creado_por_nombre
      FROM carpetas ca
      JOIN users u ON ca.creado_por = u.id
      WHERE ca.materia_id = ?
      ORDER BY ca.nombre ASC
    `,
    )
    .all(materiaId);

  const archivosByCarpetaStmt = db.prepare(
    `
    SELECT caf.id, caf.carpeta_id, caf.contenido_id, caf.nombre_archivo, caf.created_at,
      c.tipo, c.archivo_path, c.titulo
    FROM carpeta_archivos caf
    JOIN contenido c ON caf.contenido_id = c.id
    WHERE caf.carpeta_id = ?
    ORDER BY caf.created_at DESC
  `,
  );

  const payload = carpetas.map((carpeta) => ({
    ...carpeta,
    archivos: archivosByCarpetaStmt.all(carpeta.id).map((archivo) => ({
      ...archivo,
      archivo_url: toArchivoUrl(archivo.archivo_path),
    })),
  }));

  return res.status(200).json(payload);
});

router.post("/materias/:materiaId/carpetas", (req, res) => {
  const materiaId = parsePositiveInteger(req.params.materiaId);
  const nombre = String(req.body?.nombre || "").trim();

  if (!materiaId) {
    return res.status(400).json({ message: "Materia inválida." });
  }

  if (!nombre) {
    return res
      .status(422)
      .json({ message: "El nombre de la carpeta es obligatorio." });
  }

  if (nombre.length > 100) {
    return res
      .status(422)
      .json({
        message: "El nombre de la carpeta no puede superar 100 caracteres.",
      });
  }

  if (nombre.includes("/") || nombre.includes("\\") || nombre.includes("..")) {
    return res.status(422).json({
      message: "El nombre de la carpeta no puede contener / \\ ni ..",
    });
  }

  const materia = db
    .prepare("SELECT id FROM materias WHERE id = ? LIMIT 1")
    .get(materiaId);

  if (!materia) {
    return res.status(404).json({ message: "La materia no existe." });
  }

  try {
    const insert = db
      .prepare(
        `
        INSERT INTO carpetas (materia_id, nombre, creado_por)
        VALUES (?, ?, ?)
      `,
      )
      .run(materiaId, nombre, req.user.id);

    const created = db
      .prepare(
        `
        SELECT c.id, c.materia_id, c.nombre, c.creado_por, c.created_at,
          COALESCE(u.nombre_completo, u.username) AS creado_por_nombre
        FROM carpetas c
        JOIN users u ON u.id = c.creado_por
        WHERE c.id = ?
        LIMIT 1
      `,
      )
      .get(insert.lastInsertRowid);

    return res.status(201).json({ ...created, archivos: [] });
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      return res.status(409).json({
        message: "Ya existe una carpeta con ese nombre en esta materia.",
      });
    }

    return res.status(500).json({ message: "No se pudo crear la carpeta." });
  }
});

router.delete("/carpetas/:carpetaId", (req, res) => {
  const carpetaId = parsePositiveInteger(req.params.carpetaId);

  if (!carpetaId) {
    return res.status(400).json({ message: "Carpeta inválida." });
  }

  const carpeta = getCarpetaById(carpetaId);

  if (!carpeta) {
    return res.status(404).json({ message: "La carpeta no existe." });
  }

  const eliminarCarpeta = db.transaction((targetCarpetaId) => {
    const archivos = db
      .prepare(
        `
        SELECT c.id AS contenido_id, c.archivo_path
        FROM carpeta_archivos caf
        JOIN contenido c ON caf.contenido_id = c.id
        WHERE caf.carpeta_id = ?
      `,
      )
      .all(targetCarpetaId);

    for (const archivo of archivos) {
      db.prepare("DELETE FROM contenido WHERE id = ?").run(
        archivo.contenido_id,
      );
    }

    db.prepare("DELETE FROM carpetas WHERE id = ?").run(targetCarpetaId);

    return {
      archivosEliminados: archivos.length,
      pathsAEliminar: archivos
        .map((item) => toDiskRelativePath(item.archivo_path))
        .filter(Boolean),
    };
  });

  const { archivosEliminados, pathsAEliminar } = eliminarCarpeta(carpetaId);

  for (const relativePath of pathsAEliminar) {
    const absolutePath = path.resolve(resolvedUploadsPath, relativePath);

    if (!absolutePath.startsWith(path.resolve(resolvedUploadsPath))) {
      continue;
    }

    try {
      fs.unlinkSync(absolutePath);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn(
          "No se pudo eliminar archivo de disco:",
          absolutePath,
          error,
        );
      } else {
        console.warn("Archivo no encontrado en disco:", absolutePath);
      }
    }
  }

  return res.status(200).json({
    message: "Carpeta eliminada correctamente",
    archivos_eliminados: archivosEliminados,
  });
});

router.post(
  "/carpetas/:carpetaId/archivos",
  (req, res, next) => {
    upload.array("archivos", 10)(req, res, (error) => {
      if (!error) {
        return next();
      }

      if (error.code === "LIMIT_FILE_SIZE") {
        return res
          .status(413)
          .json({ message: "El archivo supera el límite de 20 MB." });
      }

      return res.status(422).json({
        message: error.message || "No se pudieron procesar los archivos.",
      });
    });
  },
  (req, res) => {
    const carpetaId = parsePositiveInteger(req.params.carpetaId);

    if (!carpetaId) {
      return res.status(400).json({ message: "Carpeta inválida." });
    }

    const carpeta = getCarpetaById(carpetaId);

    if (!carpeta) {
      return res.status(404).json({ message: "La carpeta no existe." });
    }

    const files = Array.isArray(req.files) ? req.files : [];

    if (!files.length) {
      return res.status(422).json({
        message: "Debés adjuntar al menos un archivo.",
      });
    }

    const subidos = [];
    const fallidos = [];

    const createLink = db.transaction((file) => {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const tipo = extensionToTipo[extension] || "pdf";
      const tituloBase = path.basename(
        file.originalname || "archivo",
        extension,
      );
      const titulo = String(tituloBase || "archivo")
        .trim()
        .slice(0, 200);

      const contenidoResult = db
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
          carpeta.materia_id,
          titulo || "archivo",
          null,
          tipo,
          file.filename,
          null,
          null,
          null,
        );

      const contenidoId = Number(contenidoResult.lastInsertRowid);

      const linkResult = db
        .prepare(
          `
          INSERT INTO carpeta_archivos (
            carpeta_id,
            contenido_id,
            nombre_archivo
          ) VALUES (?, ?, ?)
        `,
        )
        .run(carpetaId, contenidoId, file.originalname || file.filename);

      return {
        id: Number(linkResult.lastInsertRowid),
        contenido_id: contenidoId,
        nombre_archivo: file.originalname || file.filename,
        tipo,
        archivo_url: toArchivoUrl(file.filename),
      };
    });

    for (const file of files) {
      try {
        const created = createLink(file);
        subidos.push(created);
      } catch (error) {
        fallidos.push({
          nombre_archivo: file.originalname || file.filename,
          error: error.message || "No se pudo procesar el archivo.",
        });

        if (file?.filename) {
          const absolutePath = path.resolve(resolvedUploadsPath, file.filename);
          try {
            fs.unlinkSync(absolutePath);
          } catch {
            // ignore
          }
        }
      }
    }

    return res.status(201).json({ subidos, fallidos });
  },
);

router.delete("/archivos/:archivoId", (req, res) => {
  const archivoId = parsePositiveInteger(req.params.archivoId);

  if (!archivoId) {
    return res.status(400).json({ message: "Archivo inválido." });
  }

  const archivo = db
    .prepare(
      `
      SELECT caf.id, caf.contenido_id, c.archivo_path
      FROM carpeta_archivos caf
      JOIN contenido c ON c.id = caf.contenido_id
      WHERE caf.id = ?
      LIMIT 1
    `,
    )
    .get(archivoId);

  if (!archivo) {
    return res.status(404).json({ message: "El archivo no existe." });
  }

  db.prepare("DELETE FROM contenido WHERE id = ?").run(archivo.contenido_id);

  const relativePath = toDiskRelativePath(archivo.archivo_path);
  if (relativePath) {
    const absolutePath = path.resolve(resolvedUploadsPath, relativePath);

    if (absolutePath.startsWith(path.resolve(resolvedUploadsPath))) {
      fs.unlink(absolutePath, (error) => {
        if (error && error.code !== "ENOENT") {
          console.warn(
            "No se pudo eliminar archivo de disco:",
            absolutePath,
            error,
          );
        }
      });
    }
  }

  return res.status(200).json({ message: "Archivo eliminado correctamente" });
});

module.exports = router;
