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
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('Ana García');
  });

  test('incluye el nombre de la materia', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('Análisis Matemático I');
  });

  test('incluye la probabilidad de abandono cuando rol es admin', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('72%');
    expect(prompt).toContain('ALTO');
  });

  test('incluye la probabilidad de abandono cuando rol es coordinador', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'coordinador');
    expect(prompt).toContain('72%');
    expect(prompt).toContain('ALTO');
  });

  test('NO incluye datos de abandono cuando rol es docente', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'docente');
    expect(prompt).not.toContain('Probabilidad de abandono:');
    expect(prompt).not.toContain('72%');
  });

  test('incluye la probabilidad de recursado', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('45%');
    expect(prompt).toContain('BAJO');
  });

  test('incluye la nota esperada', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('5.2');
  });

  test('incluye los parciales rendidos', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('1');
    expect(prompt).toContain('2');
  });

  test('incluye instrucción de formato con Resumen y bullets', () => {
    const prompt = generarPrompt(datosMock, prediccionesMock, 'admin');
    expect(prompt).toContain('**Resumen:**');
    expect(prompt).toContain('•');
    expect(prompt).toContain('80 palabras');
  });

  test('admin sin datos de abandono muestra no disponible', () => {
    const sinAbandono = { ...prediccionesMock, abandono: null };
    const prompt = generarPrompt(datosMock, sinAbandono, 'admin');
    expect(prompt).toContain('no disponible');
  });
});

describe('generarPromptGlobal', () => {
  const datosGlobalMock = {
    alumno: {
      nombre_completo: 'Ana García',
      anio_ingreso: 2022,
      promedio_colegio: 7.5,
      ayuda_financiera: 1,
    },
    indicadores: {
      total_cursadas: 5,
      aprobadas: 2,
      recursadas: 2,
      cursando: 1,
      abandonadas: 0,
      promedio_notas: 5.8,
      asistencia_promedio: 0.74,
    },
    materiasEnCurso: [{ nombre: 'Análisis II' }, { nombre: 'Física I' }],
    historialTexto: '- Análisis I (aprobada)\n- Álgebra (recursada)',
  };

  const prediccionesMock = {
    abandono: { probabilidad: 0.72 },
  };

  test('incluye el nombre del alumno', () => {
    const { generarPromptGlobal } = require('./sugerencias.service');
    const prompt = generarPromptGlobal(datosGlobalMock, prediccionesMock, 'admin');
    expect(prompt).toContain('Ana García');
  });

  test('incluye abandono cuando rol es admin', () => {
    const { generarPromptGlobal } = require('./sugerencias.service');
    const prompt = generarPromptGlobal(datosGlobalMock, prediccionesMock, 'admin');
    expect(prompt).toContain('72%');
    expect(prompt).toContain('ALTO');
  });

  test('incluye abandono cuando rol es coordinador', () => {
    const { generarPromptGlobal } = require('./sugerencias.service');
    const prompt = generarPromptGlobal(datosGlobalMock, prediccionesMock, 'coordinador');
    expect(prompt).toContain('72%');
    expect(prompt).toContain('ALTO');
  });

  test('NO incluye abandono cuando rol es docente', () => {
    const { generarPromptGlobal } = require('./sugerencias.service');
    const prompt = generarPromptGlobal(datosGlobalMock, prediccionesMock, 'docente');
    expect(prompt).not.toContain('Probabilidad de abandono');
  });

  test('incluye materias en curso', () => {
    const { generarPromptGlobal } = require('./sugerencias.service');
    const prompt = generarPromptGlobal(datosGlobalMock, prediccionesMock, 'admin');
    expect(prompt).toContain('Análisis II');
    expect(prompt).toContain('Física I');
  });

  test('incluye instrucción de formato con Resumen y bullets', () => {
    const { generarPromptGlobal } = require('./sugerencias.service');
    const prompt = generarPromptGlobal(datosGlobalMock, prediccionesMock, 'admin');
    expect(prompt).toContain('**Resumen:**');
    expect(prompt).toContain('80 palabras');
  });
});

describe('generarSugerencia', () => {
  beforeEach(() => {
    jest.resetModules();

    jest.mock('@google/genai', () => ({
      GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
          generateContent: jest.fn().mockResolvedValue({ text: 'Sugerencia generada' }),
        },
      })),
    }));

    jest.mock('./panel-predicciones.service', () => ({
      precalcularPrediccionesCompletas: jest.fn().mockResolvedValue({
        1: { abandono: { probabilidad: 0.8 } },
      }),
    }));

    jest.mock('../db/database', () => ({
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue({
          id: 1,
          nombre_completo: 'Test Alumno',
          anio_ingreso: 2022,
          promedio_colegio: 7,
          ayuda_financiera: 0,
          colegio_tecnico: 0,
        }),
        all: jest.fn().mockReturnValue([]),
      }),
    }));
  });

  test('returns null when alumno not found (global mode)', async () => {
    const db = require('../db/database');
    db.prepare.mockReturnValueOnce({ get: jest.fn().mockReturnValue(null) });
    const { generarSugerencia } = require('./sugerencias.service');
    const result = await generarSugerencia(1, null, 'admin');
    expect(result).toBeNull();
  });

  test('calls generarPromptGlobal path when materiaId is null', async () => {
    const { generarSugerencia } = require('./sugerencias.service');
    const result = await generarSugerencia(1, null, 'admin');
    expect(result).toBe('Sugerencia generada');
  });

  test('calls per-materia path when materiaId is provided', async () => {
    const db = require('../db/database');
    // First call returns alumno, second returns materia
    db.prepare
      .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ id: 1, nombre_completo: 'Test Alumno', anio_ingreso: 2022, promedio_colegio: 7 }) })
      .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ nombre: 'Análisis I' }) })
      .mockReturnValue({ get: jest.fn().mockReturnValue({ cnt: 0 }), all: jest.fn().mockReturnValue([]) });
    const { generarSugerencia } = require('./sugerencias.service');
    const result = await generarSugerencia(1, 5, 'docente');
    expect(result).toBe('Sugerencia generada');
  });
});
