const bcrypt = require("bcryptjs");
const db = require("./database");

function seedMateriasInscripcionesYContenido() {
  const totalMaterias = db
    .prepare("SELECT COUNT(*) AS count FROM materias")
    .get();

  if (totalMaterias.count === 0) {
    const insertMateria = db.prepare(
      "INSERT INTO materias (nombre, codigo, descripcion) VALUES (?, ?, ?)",
    );

    insertMateria.run(
      "Análisis Matemático 1",
      "AM1",
      "Fundamentos de límites y derivadas",
    );
    insertMateria.run(
      "Análisis Matemático 2",
      "AM2",
      "Integrales y aplicaciones",
    );
  }

  const alumno =
    db.prepare("SELECT id FROM users WHERE username = ?").get("alumno") ||
    db.prepare("SELECT id FROM users WHERE username = ?").get("alumno1");

  const tutor =
    db.prepare("SELECT id FROM users WHERE username = ?").get("docente") ||
    db.prepare("SELECT id FROM users WHERE username = ?").get("docente1");

  if (!alumno || !tutor) {
    console.warn(
      "No se pudo seedear contenido CDU002: faltan usuarios alumno/docente en users.",
    );
    return;
  }

  const am1 = db.prepare("SELECT id FROM materias WHERE codigo = ?").get("AM1");
  const am2 = db.prepare("SELECT id FROM materias WHERE codigo = ?").get("AM2");

  if (!am1 || !am2) {
    return;
  }

  const insertInscripcion = db.prepare(
    "INSERT OR IGNORE INTO inscripciones (alumno_id, materia_id) VALUES (?, ?)",
  );
  insertInscripcion.run(alumno.id, am1.id);
  insertInscripcion.run(alumno.id, am2.id);

  const totalContenido = db
    .prepare("SELECT COUNT(*) AS count FROM contenido")
    .get();

  if (totalContenido.count > 0) {
    return;
  }

  const insertContenido = db.prepare(`
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
  `);

  insertContenido.run(
    tutor.id,
    am1.id,
    "Guía de ejercicios - Límites",
    "Material de práctica para afianzar conceptos de límites.",
    "pdf",
    "/sample/guia-limites.pdf",
    null,
    null,
    null,
  );

  insertContenido.run(
    tutor.id,
    am1.id,
    "Introducción a derivadas",
    "Video introductorio sobre derivadas y su interpretación.",
    "video",
    null,
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    null,
    null,
  );

  insertContenido.run(
    tutor.id,
    am2.id,
    "Tabla de integrales",
    "Imagen de referencia para integrales frecuentes.",
    "imagen",
    "/sample/tabla-integrales.png",
    null,
    null,
    null,
  );

  insertContenido.run(
    tutor.id,
    am1.id,
    "Resumen del parcial 1",
    "Observaciones personalizadas para reforzar antes del recuperatorio.",
    "texto",
    null,
    null,
    "Repasá límites laterales, continuidad y derivación implícita. Priorizá ejercicios de aplicaciones.",
    alumno.id,
  );

  insertContenido.run(
    tutor.id,
    am2.id,
    "Plantilla de resolución de ejercicios",
    "Documento guía para estructurar las resoluciones.",
    "word",
    "/sample/plantilla-resolucion.docx",
    null,
    null,
    null,
  );
}

async function seedUsers() {
  const users = [
    { username: "director", password: "director123", role: "admin" },
    { username: "docente", password: "docente123", role: "docente" },
    { username: "coordinador", password: "coord123", role: "coordinador" },
    { username: "alumno", password: "alumno123", role: "alumno" },
  ];

  const insertUser = db.prepare(
    "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
  );
  const findUserByUsername = db.prepare(
    "SELECT id FROM users WHERE username = ?",
  );
  const updateUserRole = db.prepare("UPDATE users SET role = ? WHERE id = ?");
  let createdUsers = 0;
  let updatedRoles = 0;

  for (const user of users) {
    const existingUser = findUserByUsername.get(user.username);

    if (existingUser) {
      updateUserRole.run(user.role, existingUser.id);
      updatedRoles += 1;
      continue;
    }

    const hashedPassword = await bcrypt.hash(user.password, 10);
    insertUser.run(user.username, hashedPassword, user.role);
    createdUsers += 1;
  }

  console.log(
    `Seed usuarios completado. Nuevos: ${createdUsers}. Roles actualizados: ${updatedRoles}.`,
  );

  seedMateriasInscripcionesYContenido();
}

if (require.main === module) {
  seedUsers().catch((error) => {
    console.error("Error al ejecutar seed:", error);
    process.exit(1);
  });
}

module.exports = { seedUsers };
