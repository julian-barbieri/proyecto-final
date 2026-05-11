// Simulate the endpoint call directly
const express = require("express");
const {
  precalcularPrediccionesCompletas,
} = require("./src/services/panel-predicciones.service.js");
const db = require("./src/db/database.js");

async function testEndpoint() {
  try {
    const materiaId = 1;
    const alumnos = db
      .prepare("SELECT id FROM users WHERE role = 'alumno'")
      .all();
    const alumnosIds = alumnos.map((a) => a.id);

    console.log(
      `\nCalling precalcularPrediccionesCompletas with ${alumnosIds.length} alumnos...`,
    );
    const resultado = await precalcularPrediccionesCompletas(
      alumnosIds,
      materiaId,
    );

    console.log("\nRESULTADO:");
    console.log(JSON.stringify(resultado, null, 2));
  } catch (error) {
    console.error("ERROR:", error.message);
  }
  process.exit(0);
}

testEndpoint();
