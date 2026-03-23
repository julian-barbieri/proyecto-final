const bcrypt = require("bcryptjs");
const db = require("./database");

function seedMateriasInscripcionesYContenido() {
  const currentYear = new Date().getFullYear();

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
    db.prepare("SELECT id FROM users WHERE username = ?").get("alumno1") ||
    db.prepare("SELECT id FROM users WHERE username = ?").get("alumno");

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
    "INSERT OR IGNORE INTO inscripciones (alumno_id, materia_id, anio, periodo_id, estado) VALUES (?, ?, ?, ?, ?)",
  );
  insertInscripcion.run(alumno.id, am1.id, currentYear, null, "activa");

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

function seedGestionMateriasCDU005() {
  const currentYear = new Date().getFullYear();

  const coordinator =
    db.prepare("SELECT id FROM users WHERE username = ?").get("coordinador") ||
    db.prepare("SELECT id FROM users WHERE role = 'coordinador' LIMIT 1").get();

  const docente =
    db.prepare("SELECT id FROM users WHERE username = ?").get("docente1") ||
    db.prepare("SELECT id FROM users WHERE username = ?").get("docente");

  const alumno =
    db.prepare("SELECT id FROM users WHERE username = ?").get("alumno1") ||
    db.prepare("SELECT id FROM users WHERE username = ?").get("alumno");

  const am1 = db.prepare("SELECT id FROM materias WHERE codigo = ?").get("AM1");
  const am2 = db.prepare("SELECT id FROM materias WHERE codigo = ?").get("AM2");

  if (!coordinator || !docente || !alumno || !am1 || !am2) {
    return;
  }

  const totalPeriodos = db
    .prepare("SELECT COUNT(*) AS count FROM periodos_inscripcion")
    .get();

  if (totalPeriodos.count === 0) {
    db.prepare(
      `
      INSERT INTO periodos_inscripcion (
        anio,
        descripcion,
        fecha_inicio,
        fecha_fin,
        activo,
        creado_por
      ) VALUES (?, ?, ?, ?, 1, ?)
    `,
    ).run(
      currentYear,
      `Cuatrimestre 1 - ${currentYear}`,
      `${currentYear}-03-01`,
      `${currentYear}-03-31`,
      coordinator.id,
    );
  }

  const totalAsignaciones = db
    .prepare("SELECT COUNT(*) AS count FROM docente_materia")
    .get();

  if (totalAsignaciones.count === 0) {
    const insertAsignacion = db.prepare(
      `
      INSERT INTO docente_materia (
        docente_id,
        materia_id,
        anio,
        activo,
        asignado_por
      ) VALUES (?, ?, ?, ?, ?)
    `,
    );

    insertAsignacion.run(docente.id, am1.id, currentYear, 1, coordinator.id);
    insertAsignacion.run(docente.id, am2.id, currentYear, 1, coordinator.id);
    insertAsignacion.run(
      docente.id,
      am1.id,
      currentYear - 1,
      0,
      coordinator.id,
    );
  }

  const periodoActivo = db
    .prepare(
      "SELECT id FROM periodos_inscripcion WHERE activo = 1 ORDER BY id DESC LIMIT 1",
    )
    .get();

  if (!periodoActivo) {
    return;
  }

  const yaInscriptoAm1 = db
    .prepare(
      "SELECT id FROM inscripciones WHERE alumno_id = ? AND materia_id = ? AND anio = ? AND estado = 'activa' LIMIT 1",
    )
    .get(alumno.id, am1.id, currentYear);

  if (!yaInscriptoAm1) {
    db.prepare(
      `
      INSERT INTO inscripciones (
        alumno_id,
        materia_id,
        anio,
        periodo_id,
        estado
      ) VALUES (?, ?, ?, ?, 'activa')
    `,
    ).run(alumno.id, am1.id, currentYear, periodoActivo.id);
  }
}

function seedMensajeriaCDU003() {
  const am1 = db.prepare("SELECT id FROM materias WHERE codigo = ?").get("AM1");
  const am2 = db.prepare("SELECT id FROM materias WHERE codigo = ?").get("AM2");

  if (!am1 || !am2) {
    return;
  }

  const totalUnidades = db
    .prepare("SELECT COUNT(*) AS count FROM unidades")
    .get();

  if (totalUnidades.count === 0) {
    const insertUnidad = db.prepare(
      "INSERT INTO unidades (materia_id, nombre, orden) VALUES (?, ?, ?)",
    );

    insertUnidad.run(am1.id, "Unidad 1 - Límites y continuidad", 1);
    insertUnidad.run(am1.id, "Unidad 2 - Derivadas", 2);
    insertUnidad.run(am1.id, "Unidad 3 - Integrales", 3);

    insertUnidad.run(am2.id, "Unidad 1 - Funciones de varias variables", 1);
    insertUnidad.run(am2.id, "Unidad 2 - Integrales dobles", 2);
  }

  const totalConversaciones = db
    .prepare("SELECT COUNT(*) AS count FROM conversaciones")
    .get();

  if (totalConversaciones.count > 0) {
    return;
  }

  const alumno =
    db.prepare("SELECT id FROM users WHERE username = ?").get("alumno1") ||
    db.prepare("SELECT id FROM users WHERE username = ?").get("alumno");

  const tutor =
    db.prepare("SELECT id FROM users WHERE username = ?").get("docente1") ||
    db.prepare("SELECT id FROM users WHERE username = ?").get("docente");

  const unidadAm1 = db
    .prepare(
      "SELECT id FROM unidades WHERE materia_id = ? AND orden = 1 ORDER BY id ASC LIMIT 1",
    )
    .get(am1.id);

  if (!alumno || !tutor || !unidadAm1) {
    return;
  }

  const createSampleConversation = db.transaction(() => {
    const conversacionResult = db
      .prepare(
        `
        INSERT INTO conversaciones (
          asunto,
          alumno_id,
          tutor_id,
          materia_id,
          unidad_id,
          ultimo_mensaje_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      )
      .run(
        "¿Cómo se resuelven los límites indeterminados?",
        alumno.id,
        tutor.id,
        am1.id,
        unidadAm1.id,
      );

    const conversacionId = Number(conversacionResult.lastInsertRowid);

    const insertMensaje = db.prepare(
      `
      INSERT INTO mensajes (conversacion_id, remitente_id, cuerpo, leido)
      VALUES (?, ?, ?, ?)
    `,
    );

    insertMensaje.run(
      conversacionId,
      alumno.id,
      "Hola, no entiendo cómo resolver el límite 0/0. ¿Podés explicarme?",
      0,
    );

    insertMensaje.run(
      conversacionId,
      tutor.id,
      "Hola! Para los límites indeterminados podés usar la regla de L Hôpital...",
      1,
    );

    insertMensaje.run(
      conversacionId,
      alumno.id,
      "Muchas gracias, me quedó claro.",
      0,
    );
  });

  createSampleConversation();
}

function seedMensajeriaCDU007() {
  const am1 = db.prepare("SELECT id FROM materias WHERE codigo = ?").get("AM1");

  if (!am1) {
    return;
  }

  const totalConversacionesDc = db
    .prepare(
      "SELECT COUNT(*) AS count FROM conversaciones WHERE tipo_conversacion = 'docente_coordinador'",
    )
    .get();

  if (totalConversacionesDc.count > 0) {
    return;
  }

  const docente =
    db.prepare("SELECT id FROM users WHERE username = ?").get("docente1") ||
    db.prepare("SELECT id FROM users WHERE username = ?").get("docente");

  const coordinador =
    db.prepare("SELECT id FROM users WHERE username = ?").get("coordinador") ||
    db.prepare("SELECT id FROM users WHERE role = 'coordinador' LIMIT 1").get();

  if (!docente || !coordinador) {
    return;
  }

  const unidadAm1 = db
    .prepare(
      "SELECT id FROM unidades WHERE materia_id = ? ORDER BY orden ASC LIMIT 1",
    )
    .get(am1.id);

  const createSampleConversation = db.transaction(() => {
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'docente_coordinador', CURRENT_TIMESTAMP)
      `,
      )
      .run(
        "Coordinación de contenidos para Unidad 1",
        docente.id,
        coordinador.id,
        am1.id,
        unidadAm1?.id || null,
        docente.id,
        coordinador.id,
      );

    const conversacionId = Number(conversacionResult.lastInsertRowid);

    const insertMensaje = db.prepare(
      `
      INSERT INTO mensajes (conversacion_id, remitente_id, cuerpo, leido)
      VALUES (?, ?, ?, ?)
    `,
    );

    insertMensaje.run(
      conversacionId,
      docente.id,
      "Hola, ¿te parece bien publicar la guía de límites esta semana?",
      0,
    );

    insertMensaje.run(
      conversacionId,
      coordinador.id,
      "Sí, adelante. Sumá también una actividad práctica para reforzar.",
      0,
    );
  });

  createSampleConversation();
}

function seedMisCursosCDU004() {
  const totalCursadas = db
    .prepare("SELECT COUNT(*) AS count FROM cursadas")
    .get();
  const totalExamenes = db
    .prepare("SELECT COUNT(*) AS count FROM examenes")
    .get();

  if (totalCursadas.count > 0 || totalExamenes.count > 0) {
    return;
  }

  const alumno =
    db.prepare("SELECT id FROM users WHERE username = ?").get("alumno1") ||
    db.prepare("SELECT id FROM users WHERE username = ?").get("alumno");

  const am1 = db.prepare("SELECT id FROM materias WHERE codigo = ?").get("AM1");
  const am2 = db.prepare("SELECT id FROM materias WHERE codigo = ?").get("AM2");

  if (!alumno || !am1 || !am2) {
    return;
  }

  const insertCursada = db.prepare(
    "INSERT INTO cursadas (alumno_id, materia_id, anio, asistencia, estado) VALUES (?, ?, ?, ?, ?)",
  );

  insertCursada.run(alumno.id, am1.id, 2023, 0.9, "aprobada");
  insertCursada.run(alumno.id, am2.id, 2024, 0.8, "cursando");

  const insertExamen = db.prepare(
    "INSERT INTO examenes (alumno_id, materia_id, anio, tipo, instancia, rendido, nota) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  insertExamen.run(alumno.id, am1.id, 2025, "Parcial", 1, 1, 7.5);
  insertExamen.run(alumno.id, am1.id, 2025, "Parcial", 2, 1, 6.0);
  insertExamen.run(alumno.id, am1.id, 2025, "Recuperatorio", 1, 1, 5.0);
  insertExamen.run(alumno.id, am1.id, 2025, "Final", 1, 1, 4.5);

  insertExamen.run(alumno.id, am2.id, 2026, "Parcial", 1, 0, null);
  insertExamen.run(alumno.id, am2.id, 2026, "Parcial", 2, 0, null);
  insertExamen.run(alumno.id, am2.id, 2026, "Final", 1, 0, null);
}

async function seedUsers() {
  const users = [
    { username: "director", password: "director123", role: "admin" },
    { username: "docente", password: "docente123", role: "docente" },
    { username: "docente1", password: "docente123", role: "docente" },
    { username: "coordinador", password: "coord123", role: "coordinador" },
    { username: "alumno", password: "alumno123", role: "alumno" },
    { username: "alumno1", password: "alumno123", role: "alumno" },
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
  seedMensajeriaCDU003();
  seedMensajeriaCDU007();
  seedMisCursosCDU004();
  seedGestionMateriasCDU005();
}

if (require.main === module) {
  seedUsers().catch((error) => {
    console.error("Error al ejecutar seed:", error);
    process.exit(1);
  });
}

module.exports = { seedUsers };
