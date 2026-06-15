jest.mock('../db/database', () => ({
  prepare: jest.fn(() => ({
    get: jest.fn(() => ({
      id: 1,
      username: 'leg1',
      nombre_completo: 'Test User',
      email: 't@t.com',
      promedio_colegio: 7,
      anio_ingreso: 2020,
      genero: 'masculino',
      fecha_nac: '01-01-2000',
      ayuda_financiera: 1,
      colegio_tecnico: 0,
    })),
    all: jest.fn(() => []),
  })),
}));

const { calcularVariablesAbandono } = require('./prediction-variables.service');

describe('calcularVariablesAbandono', () => {
  test('retorna un objeto con propiedades "variables" y "meta"', () => {
    const result = calcularVariablesAbandono(1);
    expect(result).toHaveProperty('variables');
    expect(result).toHaveProperty('meta');
  });

  test('variables contiene exactamente los 7 campos del modelo alumno', () => {
    const { variables } = calcularVariablesAbandono(1);
    expect(Object.keys(variables).sort()).toEqual(
      ['AyudaFinanciera', 'CantExamenesRendidos', 'CantFinalesRendidos',
       'DelayPromedioRespectoPlan', 'IndiceBloqueoPromedio',
       'PromedioAsistencia', 'PromedioNotaGeneral'].sort()
    );
  });

  test('variables no contiene _meta', () => {
    const { variables } = calcularVariablesAbandono(1);
    expect(variables).not.toHaveProperty('_meta');
  });

  test('meta contiene nombre y legajo', () => {
    const { meta } = calcularVariablesAbandono(1);
    expect(meta).toHaveProperty('nombre');
    expect(meta).toHaveProperty('legajo');
  });
});
