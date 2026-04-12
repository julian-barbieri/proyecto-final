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

function seedGestionContenidoCDU008() {
  const totalCarpetas = db
    .prepare("SELECT COUNT(*) AS count FROM carpetas")
    .get()?.count;

  if (Number(totalCarpetas) > 0) {
    return;
  }

  const coordinador =
    db.prepare("SELECT id FROM users WHERE username = ?").get("coordinador") ||
    db.prepare("SELECT id FROM users WHERE role = 'coordinador' LIMIT 1").get();

  const am1 = db.prepare("SELECT id FROM materias WHERE codigo = ?").get("AM1");

  if (!coordinador || !am1) {
    return;
  }

  const createSeed = db.transaction(() => {
    const insertCarpeta = db.prepare(
      "INSERT INTO carpetas (materia_id, nombre, creado_por) VALUES (?, ?, ?)",
    );

    const parcial1 = insertCarpeta.run(am1.id, "Parcial 1", coordinador.id);
    insertCarpeta.run(am1.id, "Parcial 2", coordinador.id);
    insertCarpeta.run(am1.id, "Material de apoyo", coordinador.id);

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
        coordinador.id,
        am1.id,
        "Guía parcial 1",
        "Guía de práctica para el primer parcial.",
        "pdf",
        "/parcial1_guia.pdf",
        null,
        null,
        null,
      );

    db.prepare(
      `
      INSERT INTO carpeta_archivos (carpeta_id, contenido_id, nombre_archivo)
      VALUES (?, ?, ?)
    `,
    ).run(
      Number(parcial1.lastInsertRowid),
      Number(contenidoResult.lastInsertRowid),
      "Guía parcial 1.pdf",
    );
  });

  createSeed();
}

function seedPrediccionesAutomaticasCDU009() {
  const am1 = db.prepare("SELECT id FROM materias WHERE codigo = ?").get("AM1");
  const am2 = db.prepare("SELECT id FROM materias WHERE codigo = ?").get("AM2");

  const alumno1 = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get("alumno");

  if (!am1 || !am2 || !alumno1) {
    return;
  }

  const currentYear = new Date().getFullYear();

  db.prepare(
    `
      UPDATE users
      SET
        promedio_colegio = COALESCE(promedio_colegio, ?),
        anio_ingreso = COALESCE(anio_ingreso, ?),
        genero = COALESCE(genero, ?),
        fecha_nac = COALESCE(fecha_nac, ?),
        ayuda_financiera = COALESCE(ayuda_financiera, ?),
        colegio_tecnico = COALESCE(colegio_tecnico, ?),
        nombre_completo = COALESCE(nombre_completo, ?),
        email = COALESCE(email, ?)
      WHERE id = ?
    `,
  ).run(
    6.9,
    2022,
    "Masculino",
    "24-01-2000",
    1,
    0,
    "García, Ana",
    "alumno@usal.edu.ar",
    alumno1.id,
  );

  const alumnosExtra = [
    {
      username: "alumno",
      promedio: 7.4,
      anio_ingreso: 2021,
      genero: "Femenino",
      fecha_nac: "15-03-2001",
      ayuda_financiera: 0,
      colegio_tecnico: 1,
      nombre: "García, Ana",
      email: "alumno@usal.edu.ar",
    },
  ];

  const updateByUsername = db.prepare(
    `
      UPDATE users
      SET
        promedio_colegio = COALESCE(promedio_colegio, ?),
        anio_ingreso = COALESCE(anio_ingreso, ?),
        genero = COALESCE(genero, ?),
        fecha_nac = COALESCE(fecha_nac, ?),
        ayuda_financiera = COALESCE(ayuda_financiera, ?),
        colegio_tecnico = COALESCE(colegio_tecnico, ?),
        nombre_completo = COALESCE(nombre_completo, ?),
        email = COALESCE(email, ?)
      WHERE username = ?
    `,
  );

  for (const extra of alumnosExtra) {
    updateByUsername.run(
      extra.promedio,
      extra.anio_ingreso,
      extra.genero,
      extra.fecha_nac,
      extra.ayuda_financiera,
      extra.colegio_tecnico,
      extra.nombre,
      extra.email,
      extra.username,
    );
  }

  const seedTransaccional = db.transaction(() => {
    db.prepare("DELETE FROM examenes WHERE alumno_id = ?").run(alumno1.id);
    db.prepare("DELETE FROM cursadas WHERE alumno_id = ?").run(alumno1.id);

    const upsertInscripcion = db.prepare(
      `
      INSERT OR IGNORE INTO inscripciones (alumno_id, materia_id, anio, periodo_id, estado)
      VALUES (?, ?, ?, NULL, 'activa')
    `,
    );

    upsertInscripcion.run(alumno1.id, am1.id, currentYear);
    upsertInscripcion.run(alumno1.id, am2.id, currentYear);

    const insertCursada = db.prepare(
      "INSERT INTO cursadas (alumno_id, materia_id, anio, asistencia, estado) VALUES (?, ?, ?, ?, ?)",
    );

    insertCursada.run(alumno1.id, am1.id, 2022, 0.9, "aprobada");
    insertCursada.run(alumno1.id, am1.id, 2021, 0.65, "recursada");
    insertCursada.run(alumno1.id, am2.id, 2023, 0.8, "aprobada");

    const insertExamen = db.prepare(
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
    );

    insertExamen.run(
      alumno1.id,
      am1.id,
      2022,
      "Parcial",
      1,
      1,
      8.6,
      0,
      0,
      "14-06-2022",
      0.85,
    );
    insertExamen.run(
      alumno1.id,
      am1.id,
      2022,
      "Parcial",
      2,
      1,
      7.89,
      0,
      0,
      "04-11-2022",
      0.87,
    );
    insertExamen.run(
      alumno1.id,
      am1.id,
      2022,
      "Recuperatorio",
      1,
      0,
      null,
      1,
      0,
      "21-06-2022",
      0.85,
    );
    insertExamen.run(
      alumno1.id,
      am1.id,
      2022,
      "Final",
      1,
      1,
      6.59,
      0,
      0,
      "12-12-2022",
      0.9,
    );

    insertExamen.run(
      alumno1.id,
      am2.id,
      2023,
      "Parcial",
      1,
      1,
      5.5,
      0,
      1,
      "15-06-2023",
      0.78,
    );
    insertExamen.run(
      alumno1.id,
      am2.id,
      2023,
      "Parcial",
      2,
      1,
      6.2,
      0,
      1,
      "10-11-2023",
      0.8,
    );
    insertExamen.run(
      alumno1.id,
      am2.id,
      2023,
      "Final",
      1,
      1,
      5.8,
      0,
      1,
      "14-12-2023",
      0.8,
    );
  });

  seedTransaccional();
}

function seedDemoAlumnosCDU010() {
  // ─────────────────────────────────────────────────────────────
  // SEED DEMO V2 — 12 alumnos AM1 2026
  // ─────────────────────────────────────────────────────────────
  try {
    const usernamesAEliminar = [
      "alu0476",
      "alu0303",
      "alu0097",
      "alu0030",
      "alu0047",
      "alu0276",
      "alu0014",
      "alu0074",
      "alu0135",
      "alu0391",
    ];

    for (const username of usernamesAEliminar) {
      const user = db
        .prepare("SELECT id FROM users WHERE username = ?")
        .get(username);

      if (!user) {
        continue;
      }

      db.prepare("DELETE FROM examenes WHERE alumno_id = ?").run(user.id);
      db.prepare("DELETE FROM cursadas WHERE alumno_id = ?").run(user.id);
      db.prepare("DELETE FROM inscripciones WHERE alumno_id = ?").run(user.id);
      db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    }

    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users
        (username, password, role, nombre_completo, email,
         oauth_provider, google_id,
         genero, fecha_nac, ayuda_financiera, colegio_tecnico, promedio_colegio, anio_ingreso)
      VALUES (?, NULL, 'alumno', ?, ?, 'google', ?, ?, ?, ?, ?, ?, ?)
    `);

    const nuevosAlumnos = [
      [
        "lucas.martinez",
        "Lucas Martínez",
        "lucas.martinez@usal.edu.ar",
        "demo_lucas.martinez",
        "Masculino",
        "15-03-2007",
        0,
        0,
        7.2,
        2026,
      ],
      [
        "valentina.gomez",
        "Valentina Gómez",
        "valentina.gomez@usal.edu.ar",
        "demo_valentina.gomez",
        "Femenino",
        "22-08-2006",
        0,
        0,
        7.8,
        2026,
      ],
      [
        "mateo.fernandez",
        "Mateo Fernández",
        "mateo.fernandez@usal.edu.ar",
        "demo_mateo.fernandez",
        "Masculino",
        "05-11-2007",
        0,
        1,
        8.1,
        2026,
      ],
      [
        "sofia.rodriguez",
        "Sofía Rodríguez",
        "sofia.rodriguez@usal.edu.ar",
        "demo_sofia.rodriguez",
        "Femenino",
        "18-04-2006",
        0,
        0,
        6.9,
        2026,
      ],
      [
        "nicolas.lopez",
        "Nicolás López",
        "nicolas.lopez@usal.edu.ar",
        "demo_nicolas.lopez",
        "Masculino",
        "30-07-2006",
        0,
        0,
        6.5,
        2026,
      ],
      [
        "joaquin.perez",
        "Joaquín Pérez",
        "joaquin.perez@usal.edu.ar",
        "demo_joaquin.perez",
        "Masculino",
        "12-01-2006",
        0,
        0,
        7.3,
        2025,
      ],
      [
        "camila.torres",
        "Camila Torres",
        "camila.torres@usal.edu.ar",
        "demo_camila.torres",
        "Femenino",
        "03-06-2005",
        0,
        0,
        6.8,
        2025,
      ],
      [
        "sebastian.diaz",
        "Sebastián Díaz",
        "sebastian.diaz@usal.edu.ar",
        "demo_sebastian.diaz",
        "Masculino",
        "28-09-2005",
        0,
        0,
        7.5,
        2025,
      ],
      [
        "agustina.romero",
        "Agustina Romero",
        "agustina.romero@usal.edu.ar",
        "demo_agustina.romero",
        "Femenino",
        "14-02-2004",
        1,
        0,
        7,
        2025,
      ],
      [
        "ignacio.sanchez",
        "Ignacio Sánchez",
        "ignacio.sanchez@usal.edu.ar",
        "demo_ignacio.sanchez",
        "Masculino",
        "07-05-2004",
        0,
        0,
        6.2,
        2024,
      ],
      [
        "martina.villareal",
        "Martina Villareal",
        "martina.villareal@usal.edu.ar",
        "demo_martina.villareal",
        "Femenino",
        "19-10-2004",
        0,
        0,
        6.7,
        2024,
      ],
      [
        "tomas.acosta",
        "Tomás Acosta",
        "tomas.acosta@usal.edu.ar",
        "demo_tomas.acosta",
        "Masculino",
        "25-03-2003",
        0,
        0,
        6.4,
        2024,
      ],
    ];

    for (const alumno of nuevosAlumnos) {
      insertUser.run(...alumno);
    }

    const nuevosUsernames = nuevosAlumnos.map((alumno) => alumno[0]);
    const usernamePlaceholders = nuevosUsernames.map(() => "?").join(",");
    const nuevosUserIds = db
      .prepare(
        `SELECT id FROM users WHERE username IN (${usernamePlaceholders})`,
      )
      .all(...nuevosUsernames)
      .map((row) => row.id);

    if (nuevosUserIds.length > 0) {
      const idPlaceholders = nuevosUserIds.map(() => "?").join(",");
      db.prepare(
        `DELETE FROM examenes WHERE alumno_id IN (${idPlaceholders})`,
      ).run(...nuevosUserIds);
      db.prepare(
        `DELETE FROM cursadas WHERE alumno_id IN (${idPlaceholders})`,
      ).run(...nuevosUserIds);
      db.prepare(
        `DELETE FROM inscripciones WHERE alumno_id IN (${idPlaceholders})`,
      ).run(...nuevosUserIds);
    }

    function getId(username) {
      return db.prepare("SELECT id FROM users WHERE username = ?").get(username)
        ?.id;
    }
    function getMateriaId(codigo) {
      return db.prepare("SELECT id FROM materias WHERE codigo = ?").get(codigo)
        ?.id;
    }

    const insertCursada = db.prepare(`
      INSERT OR IGNORE INTO cursadas (alumno_id, materia_id, anio, asistencia, estado)
      VALUES (?, ?, ?, ?, ?)
    `);
    function seedC(username, data) {
      const alumnoId = getId(username);
      if (!alumnoId) {
        return;
      }
      for (const cursada of data) {
        insertCursada.run(
          alumnoId,
          getMateriaId(cursada.m),
          cursada.anio,
          cursada.asist,
          cursada.estado,
        );
      }
    }

    const insertExamen = db.prepare(`
      INSERT OR IGNORE INTO examenes
        (alumno_id, materia_id, anio, tipo, instancia,
         rendido, nota, ausente, veces_recursada, asistencia, fecha_examen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    function seedE(username, data) {
      const alumnoId = getId(username);
      if (!alumnoId) {
        return;
      }
      for (const examen of data) {
        insertExamen.run(
          alumnoId,
          getMateriaId(examen.m),
          examen.anio,
          examen.tipo,
          examen.inst,
          examen.rend,
          examen.nota ?? null,
          examen.aus ?? 0,
          examen.vrec ?? 0,
          examen.asist,
          examen.fecha,
        );
      }
    }

    seedC("lucas.martinez", [
      { m: "AM1", anio: 2026, asist: 0.88, estado: "cursando" },
    ]);

    seedC("valentina.gomez", [
      { m: "AM1", anio: 2026, asist: 0.72, estado: "cursando" },
    ]);

    seedC("mateo.fernandez", [
      { m: "AM1", anio: 2026, asist: 0.91, estado: "cursando" },
    ]);
    seedE("mateo.fernandez", [
      {
        m: "AM1",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 7.8,
        asist: 0.88,
        vrec: 0,
        fecha: "15-06-2026",
      },
    ]);

    seedC("sofia.rodriguez", [
      { m: "AM1", anio: 2026, asist: 0.84, estado: "cursando" },
    ]);
    seedE("sofia.rodriguez", [
      {
        m: "AM1",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 2.4,
        asist: 0.81,
        vrec: 0,
        fecha: "15-06-2026",
      },
      {
        m: "AM1",
        anio: 2026,
        tipo: "Recuperatorio",
        inst: 1,
        rend: 1,
        nota: 5.2,
        asist: 0.78,
        vrec: 0,
        fecha: "23-06-2026",
      },
    ]);

    seedC("nicolas.lopez", [
      { m: "AM1", anio: 2026, asist: 0.79, estado: "cursando" },
    ]);
    seedE("nicolas.lopez", [
      {
        m: "AM1",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 1.8,
        asist: 0.75,
        vrec: 0,
        fecha: "15-06-2026",
      },
      {
        m: "AM1",
        anio: 2026,
        tipo: "Recuperatorio",
        inst: 1,
        rend: 1,
        nota: 2.1,
        asist: 0.72,
        vrec: 0,
        fecha: "23-06-2026",
      },
    ]);

    seedC("joaquin.perez", [
      { m: "AM1", anio: 2025, asist: 0.62, estado: "recursada" },
      { m: "AM1", anio: 2026, asist: 0.85, estado: "cursando" },
    ]);
    seedE("joaquin.perez", [
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 5.6,
        asist: 0.68,
        vrec: 0,
        fecha: "16-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 4.8,
        asist: 0.65,
        vrec: 0,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 1,
        rend: 0,
        aus: 1,
        asist: 0.62,
        vrec: 0,
        fecha: "12-12-2025",
      },
    ]);

    seedC("camila.torres", [
      { m: "AM1", anio: 2025, asist: 0.88, estado: "recursada" },
      { m: "AM1", anio: 2026, asist: 0.9, estado: "cursando" },
    ]);
    seedE("camila.torres", [
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 2.7,
        asist: 0.85,
        vrec: 0,
        fecha: "13-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Recuperatorio",
        inst: 1,
        rend: 1,
        nota: 3.1,
        asist: 0.82,
        vrec: 0,
        fecha: "24-06-2025",
      },
      {
        m: "AM1",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 5.4,
        asist: 0.87,
        vrec: 1,
        fecha: "15-06-2026",
      },
    ]);

    seedC("sebastian.diaz", [
      { m: "AM1", anio: 2025, asist: 0.93, estado: "recursada" },
      { m: "AM1", anio: 2026, asist: 0.95, estado: "cursando" },
    ]);
    seedE("sebastian.diaz", [
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 5.2,
        asist: 0.9,
        vrec: 0,
        fecha: "13-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 6.1,
        asist: 0.96,
        vrec: 0,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 3.4,
        asist: 0.93,
        vrec: 0,
        fecha: "12-12-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 2,
        rend: 1,
        nota: 2.8,
        asist: 0.93,
        vrec: 0,
        fecha: "06-02-2026",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 3,
        rend: 1,
        nota: 1.9,
        asist: 0.93,
        vrec: 0,
        fecha: "10-07-2026",
      },
      {
        m: "AM1",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 7.1,
        asist: 0.93,
        vrec: 1,
        fecha: "15-06-2026",
      },
    ]);

    seedC("agustina.romero", [
      { m: "AM1", anio: 2025, asist: 0.87, estado: "recursada" },
      { m: "AM1", anio: 2026, asist: 0.83, estado: "cursando" },
    ]);
    seedE("agustina.romero", [
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 4.3,
        asist: 0.82,
        vrec: 0,
        fecha: "13-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 2.5,
        asist: 0.9,
        vrec: 0,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Recuperatorio",
        inst: 2,
        rend: 1,
        nota: 3.2,
        asist: 0.87,
        vrec: 0,
        fecha: "21-11-2025",
      },
    ]);

    seedC("ignacio.sanchez", [
      { m: "AM1", anio: 2024, asist: 0.78, estado: "recursada" },
      { m: "AM1", anio: 2025, asist: 0.82, estado: "recursada" },
      { m: "AM1", anio: 2026, asist: 0.76, estado: "cursando" },
    ]);
    seedE("ignacio.sanchez", [
      {
        m: "AM1",
        anio: 2024,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 1.9,
        asist: 0.75,
        vrec: 0,
        fecha: "14-06-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Recuperatorio",
        inst: 1,
        rend: 1,
        nota: 3.2,
        asist: 0.73,
        vrec: 0,
        fecha: "25-06-2024",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 4.1,
        asist: 0.79,
        vrec: 1,
        fecha: "13-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 2.2,
        asist: 0.85,
        vrec: 1,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Recuperatorio",
        inst: 2,
        rend: 1,
        nota: 3.7,
        asist: 0.82,
        vrec: 1,
        fecha: "21-11-2025",
      },
      {
        m: "AM1",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 1.5,
        asist: 0.73,
        vrec: 2,
        fecha: "15-06-2026",
      },
      {
        m: "AM1",
        anio: 2026,
        tipo: "Recuperatorio",
        inst: 1,
        rend: 1,
        nota: 2.3,
        asist: 0.71,
        vrec: 2,
        fecha: "23-06-2026",
      },
    ]);

    seedC("martina.villareal", [
      { m: "AM1", anio: 2024, asist: 0.58, estado: "recursada" },
      { m: "AM1", anio: 2025, asist: 0.81, estado: "recursada" },
      { m: "AM1", anio: 2026, asist: 0.88, estado: "cursando" },
    ]);
    seedE("martina.villareal", [
      {
        m: "AM1",
        anio: 2024,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 3.8,
        asist: 0.55,
        vrec: 0,
        fecha: "14-06-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Recuperatorio",
        inst: 1,
        rend: 1,
        nota: 4.2,
        asist: 0.53,
        vrec: 0,
        fecha: "25-06-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 4.5,
        asist: 0.61,
        vrec: 0,
        fecha: "08-11-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Final",
        inst: 1,
        rend: 0,
        aus: 1,
        asist: 0.58,
        vrec: 0,
        fecha: "13-12-2024",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 5.1,
        asist: 0.78,
        vrec: 1,
        fecha: "13-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 3.4,
        asist: 0.82,
        vrec: 1,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Recuperatorio",
        inst: 2,
        rend: 1,
        nota: 3.8,
        asist: 0.81,
        vrec: 1,
        fecha: "21-11-2025",
      },
      {
        m: "AM1",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 4.3,
        asist: 0.85,
        vrec: 2,
        fecha: "15-06-2026",
      },
    ]);

    seedC("tomas.acosta", [
      { m: "AM1", anio: 2024, asist: 0.86, estado: "recursada" },
      { m: "AM1", anio: 2025, asist: 0.91, estado: "recursada" },
      { m: "AM1", anio: 2026, asist: 0.82, estado: "cursando" },
    ]);
    seedE("tomas.acosta", [
      {
        m: "AM1",
        anio: 2024,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 5.7,
        asist: 0.83,
        vrec: 0,
        fecha: "14-06-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 4.9,
        asist: 0.88,
        vrec: 0,
        fecha: "08-11-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 2.9,
        asist: 0.86,
        vrec: 0,
        fecha: "13-12-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Final",
        inst: 2,
        rend: 1,
        nota: 3.1,
        asist: 0.86,
        vrec: 0,
        fecha: "07-02-2025",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Final",
        inst: 3,
        rend: 1,
        nota: 2.5,
        asist: 0.86,
        vrec: 0,
        fecha: "11-07-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 6.2,
        asist: 0.89,
        vrec: 1,
        fecha: "13-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 5.8,
        asist: 0.93,
        vrec: 1,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 3.5,
        asist: 0.91,
        vrec: 1,
        fecha: "12-12-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 2,
        rend: 1,
        nota: 3.2,
        asist: 0.91,
        vrec: 1,
        fecha: "06-02-2026",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 3,
        rend: 1,
        nota: 2.8,
        asist: 0.91,
        vrec: 1,
        fecha: "10-07-2026",
      },
    ]);

    const insertInscripcion = db.prepare(`
      INSERT OR IGNORE INTO inscripciones (alumno_id, materia_id, anio, estado)
      VALUES (?, ?, ?, 'activa')
    `);
    const todos2026 = [
      "lucas.martinez",
      "valentina.gomez",
      "mateo.fernandez",
      "sofia.rodriguez",
      "nicolas.lopez",
      "joaquin.perez",
      "camila.torres",
      "sebastian.diaz",
      "agustina.romero",
      "ignacio.sanchez",
      "martina.villareal",
      "tomas.acosta",
    ];

    for (const username of todos2026) {
      const alumnoId = getId(username);
      if (alumnoId) {
        insertInscripcion.run(alumnoId, getMateriaId("AM1"), 2026);
      }
    }

    console.log("✅ Seed demo v2: 12 alumnos AM1 2026 insertados.");
  } catch (error) {
    console.error("❌ Error en seed demo v2 CDU011:", error.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SEED CDU014 — 13 alumnos AM2 2026 + actualización panel + dashboard
// ═════════════════════════════════════════════════════════════════════════════
function seedDemoAlumnosAM2CDU014() {
  try {
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users
        (username, password, role, nombre_completo, email,
         oauth_provider, google_id,
         genero, fecha_nac, ayuda_financiera, colegio_tecnico, promedio_colegio, anio_ingreso)
      VALUES (?, NULL, 'alumno', ?, ?, 'google', ?, ?, ?, ?, ?, ?, ?)
    `);

    // ──────────────────────────────────────────────────────────────────────
    // 13 alumnos AM2 2026 — Perfiles variados
    // ──────────────────────────────────────────────────────────────────────
    const alumnosAM2 = [
      // PERFIL A: 1ra vez AM2, sin exámenes (recién empezaron)
      [
        "ana.benitez",
        "Ana Benítez",
        "ana.benitez@usal.edu.ar",
        "demo_ana.benitez",
        "Femenino",
        "08-02-2006",
        0,
        0,
        7.6,
        2025,
      ],
      [
        "rodrigo.molina",
        "Rodrigo Molina",
        "rodrigo.molina@usal.edu.ar",
        "demo_rodrigo.molina",
        "Masculino",
        "21-09-2005",
        0,
        1,
        8.2,
        2025,
      ],
      [
        "luciana.herrera",
        "Luciana Herrera",
        "luciana.herrera@usal.edu.ar",
        "demo_luciana.herrera",
        "Femenino",
        "14-05-2006",
        0,
        0,
        7.1,
        2025,
      ],

      // PERFIL B: 1ra vez AM2, Parcial 1 ya rendido (junio 2026)
      [
        "diego.castro",
        "Diego Castro",
        "diego.castro@usal.edu.ar",
        "demo_diego.castro",
        "Masculino",
        "03-11-2005",
        0,
        0,
        7.4,
        2025,
      ],
      [
        "florencia.ramos",
        "Florencia Ramos",
        "florencia.ramos@usal.edu.ar",
        "demo_florencia.ramos",
        "Femenino",
        "17-07-2005",
        0,
        0,
        6.8,
        2025,
      ],
      [
        "ezequiel.vargas",
        "Ezequiel Vargas",
        "ezequiel.vargas@usal.edu.ar",
        "demo_ezequiel.vargas",
        "Masculino",
        "29-03-2005",
        0,
        0,
        7.9,
        2025,
      ],
      [
        "camila.mendez",
        "Camila Méndez",
        "camila.mendez@usal.edu.ar",
        "demo_camila.mendez",
        "Femenino",
        "12-12-2004",
        1,
        0,
        6.5,
        2025,
      ],

      // PERFIL C: 2da vez AM2 (recursaron 2025)
      [
        "martin.ibarra",
        "Martín Ibarra",
        "martin.ibarra@usal.edu.ar",
        "demo_martin.ibarra",
        "Masculino",
        "05-06-2004",
        0,
        0,
        6.9,
        2024,
      ],
      [
        "natalia.quispe",
        "Natalia Quispe",
        "natalia.quispe@usal.edu.ar",
        "demo_natalia.quispe",
        "Femenino",
        "22-08-2004",
        0,
        0,
        7.2,
        2024,
      ],
      [
        "pablo.luna",
        "Pablo Luna",
        "pablo.luna@usal.edu.ar",
        "demo_pablo.luna",
        "Masculino",
        "14-11-2003",
        0,
        0,
        6.5,
        2023,
      ],

      // PERFIL D: Final AM1 pendiente (cursan AM2 pero no aprobaron final AM1)
      [
        "valeria.mora",
        "Valeria Mora",
        "valeria.mora@usal.edu.ar",
        "demo_valeria.mora",
        "Femenino",
        "01-03-2005",
        0,
        0,
        7.3,
        2024,
      ],
      [
        "gabriel.silva",
        "Gabriel Silva",
        "gabriel.silva@usal.edu.ar",
        "demo_gabriel.silva",
        "Masculino",
        "16-07-2005",
        0,
        0,
        7.55,
        2025,
      ],
      [
        "antonella.reyes",
        "Antonella Reyes",
        "antonella.reyes@usal.edu.ar",
        "demo_antonella.reyes",
        "Femenino",
        "28-06-2005",
        0,
        0,
        7.8,
        2025,
      ],
    ];

    for (const alumno of alumnosAM2) {
      insertUser.run(...alumno);
    }

    function getId(username) {
      return db.prepare("SELECT id FROM users WHERE username = ?").get(username)
        ?.id;
    }
    function getMateriaId(codigo) {
      return db.prepare("SELECT id FROM materias WHERE codigo = ?").get(codigo)
        ?.id;
    }

    const insertCursada = db.prepare(`
      INSERT OR IGNORE INTO cursadas (alumno_id, materia_id, anio, asistencia, estado)
      VALUES (?, ?, ?, ?, ?)
    `);
    function seedC(username, data) {
      const alumnoId = getId(username);
      if (!alumnoId) return;
      for (const cursada of data) {
        insertCursada.run(
          alumnoId,
          getMateriaId(cursada.m),
          cursada.anio,
          cursada.asist,
          cursada.estado,
        );
      }
    }

    const insertExamen = db.prepare(`
      INSERT OR IGNORE INTO examenes
        (alumno_id, materia_id, anio, tipo, instancia,
         rendido, nota, ausente, veces_recursada, asistencia, fecha_examen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    function seedE(username, data) {
      const alumnoId = getId(username);
      if (!alumnoId) return;
      for (const examen of data) {
        insertExamen.run(
          alumnoId,
          getMateriaId(examen.m),
          examen.anio,
          examen.tipo,
          examen.inst,
          examen.rend,
          examen.nota ?? null,
          examen.aus ?? 0,
          examen.vrec ?? 0,
          examen.asist,
          examen.fecha,
        );
      }
    }

    const insertInscripcion = db.prepare(`
      INSERT OR IGNORE INTO inscripciones (alumno_id, materia_id, anio, estado)
      VALUES (?, ?, ?, 'activa')
    `);

    // ══════════════════════════════════════════════════════════════════════
    // PERFIL A — 1ra vez AM2 2026, sin exámenes todavía
    // (aprobaron AM1 el año anterior, empezaron AM2 en marzo 2026)
    // ══════════════════════════════════════════════════════════════════════

    // Ana Benítez — buena estudiante, aprobó AM1 2025 con buen promedio
    seedC("ana.benitez", [
      { m: "AM1", anio: 2025, asist: 0.92, estado: "aprobada" },
      { m: "AM2", anio: 2026, asist: 0.89, estado: "cursando" },
    ]);
    seedE("ana.benitez", [
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 7.4,
        asist: 0.91,
        vrec: 0,
        fecha: "16-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 7.5,
        asist: 0.93,
        vrec: 0,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 8.4,
        asist: 0.92,
        vrec: 0,
        fecha: "12-12-2025",
      },
    ]);

    // Rodrigo Molina — perfil técnico (ColegioTecnico=1), alto rendimiento en AM1
    seedC("rodrigo.molina", [
      { m: "AM1", anio: 2025, asist: 0.95, estado: "aprobada" },
      { m: "AM2", anio: 2026, asist: 0.93, estado: "cursando" },
    ]);
    seedE("rodrigo.molina", [
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 8.9,
        asist: 0.93,
        vrec: 0,
        fecha: "16-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 8.5,
        asist: 0.97,
        vrec: 0,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 9.1,
        asist: 0.95,
        vrec: 0,
        fecha: "12-12-2025",
      },
    ]);

    // Luciana Herrera — asistencia levemente baja (0.73), en riesgo de no rendir finales AM2
    seedC("luciana.herrera", [
      { m: "AM1", anio: 2025, asist: 0.81, estado: "aprobada" },
      { m: "AM2", anio: 2026, asist: 0.73, estado: "cursando" },
    ]);
    seedE("luciana.herrera", [
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 5.4,
        asist: 0.78,
        vrec: 0,
        fecha: "16-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 6.2,
        asist: 0.84,
        vrec: 0,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 5.8,
        asist: 0.81,
        vrec: 0,
        fecha: "12-12-2025",
      },
    ]);

    // ══════════════════════════════════════════════════════════════════════
    // PERFIL B — 1ra vez AM2, Parcial 1 ya rendido (junio 2026)
    // ══════════════════════════════════════════════════════════════════════

    // Diego Castro — aprobó Parcial 1 de AM2 con buena nota
    seedC("diego.castro", [
      { m: "AM1", anio: 2025, asist: 0.87, estado: "aprobada" },
      { m: "AM2", anio: 2026, asist: 0.88, estado: "cursando" },
    ]);
    seedE("diego.castro", [
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 6.1,
        asist: 0.84,
        vrec: 0,
        fecha: "16-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 6.4,
        asist: 0.9,
        vrec: 0,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 6.7,
        asist: 0.87,
        vrec: 0,
        fecha: "12-12-2025",
      },
      {
        m: "AM2",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 6.7,
        asist: 0.86,
        vrec: 0,
        fecha: "17-06-2026",
      },
    ]);

    // Florencia Ramos — desaprobó Parcial 1 de AM2, fue al Recuperatorio 1 y aprobó
    seedC("florencia.ramos", [
      { m: "AM1", anio: 2025, asist: 0.83, estado: "aprobada" },
      { m: "AM2", anio: 2026, asist: 0.85, estado: "cursando" },
    ]);
    seedE("florencia.ramos", [
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 5.3,
        asist: 0.8,
        vrec: 0,
        fecha: "16-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 5.8,
        asist: 0.86,
        vrec: 0,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 5.4,
        asist: 0.83,
        vrec: 0,
        fecha: "12-12-2025",
      },
      {
        m: "AM2",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 0,
        nota: null,
        asist: 0.82,
        vrec: 0,
        fecha: "17-06-2026",
      },
      {
        m: "AM2",
        anio: 2026,
        tipo: "Recuperatorio",
        inst: 1,
        rend: 1,
        nota: 5.1,
        asist: 0.8,
        vrec: 0,
        fecha: "24-06-2026",
      },
    ]);

    // Ezequiel Vargas — aprobó Parcial 1 de AM2 con nota alta
    seedC("ezequiel.vargas", [
      { m: "AM1", anio: 2025, asist: 0.94, estado: "aprobada" },
      { m: "AM2", anio: 2026, asist: 0.91, estado: "cursando" },
    ]);
    seedE("ezequiel.vargas", [
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 8.3,
        asist: 0.92,
        vrec: 0,
        fecha: "16-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 8.1,
        asist: 0.96,
        vrec: 0,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 8.5,
        asist: 0.94,
        vrec: 0,
        fecha: "12-12-2025",
      },
      {
        m: "AM2",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 8.1,
        asist: 0.89,
        vrec: 0,
        fecha: "17-06-2026",
      },
    ]);

    // Camila Méndez — ayuda financiera (1), desaprobó P1 AM2 y Rec1 AM2 → año perdido
    seedC("camila.mendez", [
      { m: "AM1", anio: 2025, asist: 0.8, estado: "aprobada" },
      { m: "AM2", anio: 2026, asist: 0.78, estado: "cursando" },
    ]);
    seedE("camila.mendez", [
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 4.5,
        asist: 0.77,
        vrec: 0,
        fecha: "16-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Recuperatorio",
        inst: 1,
        rend: 1,
        nota: 5.2,
        asist: 0.79,
        vrec: 0,
        fecha: "24-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 5.1,
        asist: 0.81,
        vrec: 0,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 4.8,
        asist: 0.8,
        vrec: 0,
        fecha: "12-12-2025",
      },
      {
        m: "AM2",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 0,
        nota: null,
        asist: 0.75,
        vrec: 0,
        fecha: "17-06-2026",
      },
      {
        m: "AM2",
        anio: 2026,
        tipo: "Recuperatorio",
        inst: 1,
        rend: 1,
        nota: 2.4,
        asist: 0.73,
        vrec: 0,
        fecha: "24-06-2026",
      },
    ]);

    // ══════════════════════════════════════════════════════════════════════
    // PERFIL C — 2da vez cursando AM2 (recursaron en 2025)
    // ══════════════════════════════════════════════════════════════════════

    // Martín Ibarra — recursó AM2 2025 por baja asistencia (no pudo rendir finales)
    // En 2026: mejoró asistencia, ya tiene P1 rendido
    seedC("martin.ibarra", [
      { m: "AM1", anio: 2024, asist: 0.88, estado: "aprobada" },
      { m: "AM2", anio: 2025, asist: 0.72, estado: "recursada" },
      { m: "AM2", anio: 2026, asist: 0.86, estado: "cursando" },
    ]);
    seedE("martin.ibarra", [
      {
        m: "AM1",
        anio: 2024,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 6.8,
        asist: 0.86,
        vrec: 0,
        fecha: "15-06-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 6.5,
        asist: 0.9,
        vrec: 0,
        fecha: "08-11-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 6.9,
        asist: 0.88,
        vrec: 0,
        fecha: "11-12-2024",
      },
      {
        m: "AM2",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 4.2,
        asist: 0.68,
        vrec: 0,
        fecha: "18-06-2025",
      },
      {
        m: "AM2",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 0,
        aus: 1,
        asist: 0.65,
        vrec: 0,
        fecha: "12-11-2025",
      },
      {
        m: "AM2",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 5.8,
        asist: 0.84,
        vrec: 1,
        fecha: "17-06-2026",
      },
    ]);

    // Natalia Quispe — recursó AM2 2025 por desaprobar P2 y Rec2
    // En 2026: sin exámenes todavía
    seedC("natalia.quispe", [
      { m: "AM1", anio: 2024, asist: 0.91, estado: "aprobada" },
      { m: "AM2", anio: 2025, asist: 0.79, estado: "recursada" },
      { m: "AM2", anio: 2026, asist: 0.84, estado: "cursando" },
    ]);
    seedE("natalia.quispe", [
      {
        m: "AM1",
        anio: 2024,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 7.6,
        asist: 0.89,
        vrec: 0,
        fecha: "15-06-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 7.4,
        asist: 0.93,
        vrec: 0,
        fecha: "08-11-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 7.8,
        asist: 0.91,
        vrec: 0,
        fecha: "11-12-2024",
      },
      {
        m: "AM2",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 6.1,
        asist: 0.76,
        vrec: 0,
        fecha: "18-06-2025",
      },
      {
        m: "AM2",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 0,
        nota: null,
        asist: 0.73,
        vrec: 0,
        fecha: "12-11-2025",
      },
    ]);

    // Pablo Luna — recursó AM2 2025 por agotar los 3 finales
    // En 2026: aprobó P1 con buena nota (determinado a aprobar)
    seedC("pablo.luna", [
      { m: "AM1", anio: 2023, asist: 0.84, estado: "aprobada" },
      { m: "AM2", anio: 2025, asist: 0.75, estado: "recursada" },
      { m: "AM2", anio: 2026, asist: 0.88, estado: "cursando" },
    ]);
    seedE("pablo.luna", [
      {
        m: "AM1",
        anio: 2023,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 6.5,
        asist: 0.82,
        vrec: 0,
        fecha: "14-06-2023",
      },
      {
        m: "AM1",
        anio: 2023,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 6.7,
        asist: 0.86,
        vrec: 0,
        fecha: "07-11-2023",
      },
      {
        m: "AM1",
        anio: 2023,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 6.8,
        asist: 0.84,
        vrec: 0,
        fecha: "13-12-2023",
      },
      {
        m: "AM2",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 5.3,
        asist: 0.71,
        vrec: 0,
        fecha: "18-06-2025",
      },
      {
        m: "AM2",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 4.8,
        asist: 0.73,
        vrec: 0,
        fecha: "12-11-2025",
      },
      {
        m: "AM2",
        anio: 2025,
        tipo: "Final",
        inst: 1,
        rend: 0,
        aus: 1,
        asist: 0.75,
        vrec: 0,
        fecha: "17-12-2025",
      },
      {
        m: "AM2",
        anio: 2025,
        tipo: "Final",
        inst: 2,
        rend: 0,
        aus: 1,
        asist: 0.75,
        vrec: 0,
        fecha: "12-02-2026",
      },
      {
        m: "AM2",
        anio: 2025,
        tipo: "Final",
        inst: 3,
        rend: 0,
        aus: 1,
        asist: 0.75,
        vrec: 0,
        fecha: "16-07-2026",
      },
      {
        m: "AM2",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 6.3,
        asist: 0.86,
        vrec: 1,
        fecha: "17-06-2026",
      },
    ]);

    // ══════════════════════════════════════════════════════════════════════
    // PERFIL D — Final AM1 pendiente (cursan AM2 pero no aprobaron final AM1)
    // ══════════════════════════════════════════════════════════════════════

    // Valeria Mora — aprobó parciales AM1, tiene 2 finales AM1 fallidos
    // Está cursando AM2 2026 y rindiendo parciales; los finales de AM2 están bloqueados
    seedC("valeria.mora", [
      { m: "AM1", anio: 2024, asist: 0.85, estado: "aprobada" },
      { m: "AM2", anio: 2026, asist: 0.87, estado: "cursando" },
    ]);
    seedE("valeria.mora", [
      {
        m: "AM1",
        anio: 2024,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 6.3,
        asist: 0.83,
        vrec: 0,
        fecha: "15-06-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 6.1,
        asist: 0.87,
        vrec: 0,
        fecha: "08-11-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 3.8,
        asist: 0.85,
        vrec: 0,
        fecha: "11-12-2024",
      },
      {
        m: "AM1",
        anio: 2024,
        tipo: "Final",
        inst: 2,
        rend: 1,
        nota: 3.6,
        asist: 0.85,
        vrec: 0,
        fecha: "06-02-2025",
      },
    ]);

    // Gabriel Silva — aprobó parciales AM1 2025, tiene Final AM1 inst 1 desaprobado
    // Está cursando AM2 2026 sin exámenes todavía; tiene el Final AM1 inst 2 pendiente
    seedC("gabriel.silva", [
      { m: "AM1", anio: 2025, asist: 0.89, estado: "aprobada" },
      { m: "AM2", anio: 2026, asist: 0.82, estado: "cursando" },
    ]);
    seedE("gabriel.silva", [
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 7.2,
        asist: 0.87,
        vrec: 0,
        fecha: "16-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 6.9,
        asist: 0.91,
        vrec: 0,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 3.4,
        asist: 0.89,
        vrec: 0,
        fecha: "12-12-2025",
      },
    ]);

    // Antonella Reyes — aprobó parciales AM1 y tiene Final AM1 aprobado → SÍ puede rendir finales AM2
    // Desaprobó P1 de AM2 pero aprobó Recuperatorio 1 de AM2
    seedC("antonella.reyes", [
      { m: "AM1", anio: 2025, asist: 0.91, estado: "aprobada" },
      { m: "AM2", anio: 2026, asist: 0.9, estado: "cursando" },
    ]);
    seedE("antonella.reyes", [
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 1,
        rend: 1,
        nota: 7.6,
        asist: 0.89,
        vrec: 0,
        fecha: "16-06-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Parcial",
        inst: 2,
        rend: 1,
        nota: 7.8,
        asist: 0.93,
        vrec: 0,
        fecha: "07-11-2025",
      },
      {
        m: "AM1",
        anio: 2025,
        tipo: "Final",
        inst: 1,
        rend: 1,
        nota: 7.9,
        asist: 0.91,
        vrec: 0,
        fecha: "12-12-2025",
      },
      {
        m: "AM2",
        anio: 2026,
        tipo: "Parcial",
        inst: 1,
        rend: 0,
        nota: null,
        asist: 0.88,
        vrec: 0,
        fecha: "17-06-2026",
      },
      {
        m: "AM2",
        anio: 2026,
        tipo: "Recuperatorio",
        inst: 1,
        rend: 1,
        nota: 5.3,
        asist: 0.89,
        vrec: 0,
        fecha: "24-06-2026",
      },
    ]);

    // ── Inscripciones activas AM2 2026 ────────────────────────────────────
    const todosAM2 = [
      "ana.benitez",
      "rodrigo.molina",
      "luciana.herrera",
      "diego.castro",
      "florencia.ramos",
      "ezequiel.vargas",
      "camila.mendez",
      "martin.ibarra",
      "natalia.quispe",
      "pablo.luna",
      "valeria.mora",
      "gabriel.silva",
      "antonella.reyes",
    ];

    for (const u of todosAM2) {
      const aid = getId(u);
      if (aid) insertInscripcion.run(aid, getMateriaId("AM2"), 2026);
    }

    console.log("✅ Seed AM2 2026: 13 alumnos insertados correctamente.");
  } catch (error) {
    console.error("❌ Error en seed AM2 CDU014:", error.message);
  }
}

async function seedUsers() {
  const users = [
    {
      username: "director",
      password: "director123",
      role: "admin",
      nombre_completo: "Director Sistema",
    },
    {
      username: "docente",
      password: "docente123",
      role: "docente",
      nombre_completo: "Docente Primero",
    },
    {
      username: "docente1",
      password: "docente123",
      role: "docente",
      nombre_completo: "Segundo Docente",
    },
    {
      username: "coordinador",
      password: "coord123",
      role: "coordinador",
      nombre_completo: "Coordinador Académico",
    },
    {
      username: "alumno",
      password: "alumno123",
      role: "alumno",
      nombre_completo: "Juan Alumno",
    },
  ];

  const insertUser = db.prepare(
    "INSERT INTO users (username, password, role, nombre_completo) VALUES (?, ?, ?, ?)",
  );
  const findUserByUsername = db.prepare(
    "SELECT id FROM users WHERE username = ?",
  );
  const updateUserRole = db.prepare(
    "UPDATE users SET role = ?, nombre_completo = ? WHERE id = ?",
  );
  let createdUsers = 0;
  let updatedRoles = 0;

  for (const user of users) {
    const existingUser = findUserByUsername.get(user.username);

    if (existingUser) {
      updateUserRole.run(user.role, user.nombre_completo, existingUser.id);
      updatedRoles += 1;
      continue;
    }

    const hashedPassword = await bcrypt.hash(user.password, 10);
    insertUser.run(
      user.username,
      hashedPassword,
      user.role,
      user.nombre_completo,
    );
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
  seedGestionContenidoCDU008();
  seedPrediccionesAutomaticasCDU009();
  seedDemoAlumnosCDU010();
  seedDemoAlumnosAM2CDU014();
}

if (require.main === module) {
  seedUsers().catch((error) => {
    console.error("Error al ejecutar seed:", error);
    process.exit(1);
  });
}

module.exports = { seedUsers };
