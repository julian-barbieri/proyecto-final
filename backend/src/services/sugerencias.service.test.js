const { getNivelRiesgo, generarPrompt } = require('./sugerencias.service');

describe('getNivelRiesgo', () => {
  test('retorna ALTO cuando probabilidad >= 0.7', () => {
    expect(getNivelRiesgo(0.7)).toBe('ALTO');
    expect(getNivelRiesgo(0.85)).toBe('ALTO');
    expect(getNivelRiesgo(1.0)).toBe('ALTO');
  });

  test('retorna MEDIO cuando probabilidad >= 0.5 y < 0.7', () => {
    expect(getNivelRiesgo(0.5)).toBe('MEDIO');
    expect(getNivelRiesgo(0.65)).toBe('MEDIO');
    expect(getNivelRiesgo(0.699)).toBe('MEDIO');
  });

  test('retorna BAJO cuando probabilidad < 0.5', () => {
    expect(getNivelRiesgo(0.0)).toBe('BAJO');
    expect(getNivelRiesgo(0.3)).toBe('BAJO');
    expect(getNivelRiesgo(0.499)).toBe('BAJO');
  });
});

describe('generarPrompt', () => {
  const datosMock = {
    alumno: { nombre_completo: 'Ana García', anio_ingreso: 2022, promedio_colegio: 7 },
    materia: { nombre: 'Análisis Matemático I' },
    vars: { PromedioNota: 5.5, PromedioAsistencia: 0.72, CantRecursa: 1 },
    cursadaActual: { anio: 2024, asistencia: 0.68 },
    vecesCursada: 2,
    parcialesRendidos: 1,
    totalParciales: 2,
    historialCursadas: [
      { anio: 2023, estado: 'recursada', materia_nombre: 'Análisis Matemático I' },
    ],
    ultimosExamenes: [
      { anio: 2024, tipo: 'Parcial', nota: 4, materia_nombre: 'Análisis Matemático I' },
    ],
  };

  const prediccionesMock = {
    abandono: { probabilidad: 0.72 },
    recursado: { probabilidad: 0.45 },
    nota: { nota: 5.2 },
  };

  test('incluye el nombre del alumno en el prompt', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock);
    expect(prompt).toContain('Ana García');
  });

  test('incluye el nombre de la materia', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock);
    expect(prompt).toContain('Análisis Matemático I');
  });

  test('incluye la probabilidad de abandono formateada como porcentaje', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock);
    expect(prompt).toContain('72%');
    expect(prompt).toContain('ALTO');
  });

  test('incluye la probabilidad de recursado', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock);
    expect(prompt).toContain('45%');
    expect(prompt).toContain('BAJO');
  });

  test('incluye la nota esperada', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock);
    expect(prompt).toContain('5.2');
  });

  test('incluye los parciales rendidos', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock);
    expect(prompt).toContain('1');
    expect(prompt).toContain('2');
  });

  test('funciona sin predicciones de abandono', () => {
    const sinAbandono = { ...prediccionesMock, abandono: null };
    const prompt = generarPrompt(datosMock, sinAbandono);
    expect(prompt).toContain('no disponible');
  });
});
