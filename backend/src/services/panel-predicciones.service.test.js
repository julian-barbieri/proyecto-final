jest.mock('../db/database', () => ({
  prepare: jest.fn(() => ({
    get: jest.fn(() => null),
    all: jest.fn(() => []),
  })),
}));

const {
  normalizeAlumnoPayload,
  normalizeMateriaPayload,
  normalizeExamenPayload,
} = require('./panel-predicciones.service');

describe('normalizeAlumnoPayload', () => {
  test('castea solo los 5 campos del modelo alumno', () => {
    const input = [{
      PromedioNotaGeneral: '5.5',
      PromedioAsistencia: '0.8',
      AyudaFinanciera: '1',
      CantExamenesRendidos: '10',
      CantFinalesRendidos: '3',
      campoExtra: 99,
    }];
    const result = normalizeAlumnoPayload(input);
    expect(result[0]).toStrictEqual({
      PromedioNotaGeneral: 5.5,
      PromedioAsistencia: 0.8,
      AyudaFinanciera: 1,
      CantExamenesRendidos: 10,
      CantFinalesRendidos: 3,
    });
  });

  test('no incluye campos extra', () => {
    const result = normalizeAlumnoPayload([{
      PromedioNotaGeneral: 5, PromedioAsistencia: 0.7,
      AyudaFinanciera: 0, CantExamenesRendidos: 5, CantFinalesRendidos: 1,
    }]);
    expect(Object.keys(result[0])).toHaveLength(5);
  });
});

describe('normalizeMateriaPayload', () => {
  test('castea solo los 5 campos del modelo materia', () => {
    const input = [{
      PromedioNotaGeneral: '6',
      PromedioAsistencia: '0.9',
      AyudaFinanciera: '0',
      Materia: '145',
      PromedioColegio: '7.5',
      campoExtra: 'x',
    }];
    const result = normalizeMateriaPayload(input);
    expect(result[0]).toStrictEqual({
      PromedioNotaGeneral: 6,
      PromedioAsistencia: 0.9,
      AyudaFinanciera: 0,
      Materia: 145,
      PromedioColegio: 7.5,
    });
  });

  test('no incluye campos extra', () => {
    const result = normalizeMateriaPayload([{
      PromedioNotaGeneral: 6, PromedioAsistencia: 0.9,
      AyudaFinanciera: 0, Materia: 145, PromedioColegio: 7,
    }]);
    expect(Object.keys(result[0])).toHaveLength(5);
  });
});

describe('normalizeExamenPayload', () => {
  test('castea solo los 6 campos del modelo examen', () => {
    const input = [{
      PromedioNotaGeneral: '5',
      PromedioAsistencia: '0.75',
      AyudaFinanciera: '1',
      NotaPromedioParcialCursada: '6.5',
      TasaRecursaGeneral: '0.2',
      Materia: '152',
      TipoExamen: 'Final',
      PosicionFlujo: '5',
      Instancia: '1',
    }];
    const result = normalizeExamenPayload(input);
    expect(result[0]).toStrictEqual({
      PromedioNotaGeneral: 5,
      PromedioAsistencia: 0.75,
      AyudaFinanciera: 1,
      NotaPromedioParcialCursada: 6.5,
      TasaRecursaGeneral: 0.2,
      Materia: 152,
    });
  });

  test('no incluye TipoExamen, PosicionFlujo ni otros campos viejos', () => {
    const result = normalizeExamenPayload([{
      PromedioNotaGeneral: 5, PromedioAsistencia: 0.75,
      AyudaFinanciera: 1, NotaPromedioParcialCursada: 6.5,
      TasaRecursaGeneral: 0.2, Materia: 152,
      TipoExamen: 'Final', PosicionFlujo: 5,
    }]);
    expect(result[0]).not.toHaveProperty('TipoExamen');
    expect(result[0]).not.toHaveProperty('PosicionFlujo');
    expect(Object.keys(result[0])).toHaveLength(6);
  });
});
