function computarEstadoEfectivo(examenes, estadoDB) {
  const tieneAprobado = examenes.some(
    (e) => e.tipo === 'Final' && e.rendido && Number(e.nota) >= 4,
  );
  if (tieneAprobado) return 'aprobada';

  const recupFallido = examenes.some(
    (e) => e.tipo === 'Recuperatorio' && e.rendido && e.nota !== null && Number(e.nota) < 4,
  );
  if (recupFallido) return 'recursada';

  const finalesFallidos = examenes.filter(
    (e) => e.tipo === 'Final' && e.rendido && e.nota !== null && Number(e.nota) < 4,
  );
  if (finalesFallidos.length >= 3) return 'recursada';

  return estadoDB;
}

module.exports = { computarEstadoEfectivo };
