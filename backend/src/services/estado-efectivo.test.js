const { computarEstadoEfectivo } = require('./estado-efectivo');

describe('computarEstadoEfectivo', () => {
  test('retorna aprobada cuando hay Final con nota >= 4', () => {
    const examenes = [
      { tipo: 'Final', rendido: 1, nota: 6, instancia: 1 },
    ];
    expect(computarEstadoEfectivo(examenes, 'cursando')).toBe('aprobada');
  });

  test('retorna aprobada con nota exactamente 4', () => {
    const examenes = [{ tipo: 'Final', rendido: 1, nota: 4, instancia: 1 }];
    expect(computarEstadoEfectivo(examenes, 'cursando')).toBe('aprobada');
  });

  test('retorna recursada cuando hay Recuperatorio con nota < 4', () => {
    const examenes = [
      { tipo: 'Parcial', rendido: 1, nota: 3, instancia: 1 },
      { tipo: 'Recuperatorio', rendido: 1, nota: 2, instancia: 1 },
    ];
    expect(computarEstadoEfectivo(examenes, 'cursando')).toBe('recursada');
  });

  test('retorna recursada cuando hay 3 Finales con nota < 4', () => {
    const examenes = [
      { tipo: 'Final', rendido: 1, nota: 3, instancia: 1 },
      { tipo: 'Final', rendido: 1, nota: 2, instancia: 2 },
      { tipo: 'Final', rendido: 1, nota: 1, instancia: 3 },
    ];
    expect(computarEstadoEfectivo(examenes, 'cursando')).toBe('recursada');
  });

  test('NO retorna recursada con solo 2 Finales fallidos', () => {
    const examenes = [
      { tipo: 'Final', rendido: 1, nota: 3, instancia: 1 },
      { tipo: 'Final', rendido: 1, nota: 2, instancia: 2 },
    ];
    expect(computarEstadoEfectivo(examenes, 'cursando')).toBe('cursando');
  });

  test('aprobada tiene precedencia sobre recuperatorio fallido', () => {
    const examenes = [
      { tipo: 'Recuperatorio', rendido: 1, nota: 2, instancia: 1 },
      { tipo: 'Final', rendido: 1, nota: 7, instancia: 1 },
    ];
    expect(computarEstadoEfectivo(examenes, 'cursando')).toBe('aprobada');
  });

  test('retorna estadoDB cuando no hay condición especial', () => {
    const examenes = [
      { tipo: 'Parcial', rendido: 1, nota: 5, instancia: 1 },
    ];
    expect(computarEstadoEfectivo(examenes, 'cursando')).toBe('cursando');
  });

  test('ignora finales con nota = null', () => {
    const examenes = [
      { tipo: 'Final', rendido: 1, nota: null, instancia: 1 },
      { tipo: 'Final', rendido: 1, nota: null, instancia: 2 },
      { tipo: 'Final', rendido: 1, nota: null, instancia: 3 },
    ];
    expect(computarEstadoEfectivo(examenes, 'cursando')).toBe('cursando');
  });

  test('ignora finales no rendidos', () => {
    const examenes = [
      { tipo: 'Final', rendido: 0, nota: 2, instancia: 1 },
    ];
    expect(computarEstadoEfectivo(examenes, 'cursando')).toBe('cursando');
  });

  test('retorna estadoDB si examenes es array vacío', () => {
    expect(computarEstadoEfectivo([], 'abandonada')).toBe('abandonada');
  });
});
