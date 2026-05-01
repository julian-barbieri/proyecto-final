const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { generarSugerencia } = require('../services/sugerencias.service');

const router = express.Router();

const CACHE_TTL_MS = 60 * 60 * 1000;
const sugerenciasCache = new Map();

function getCached(key) {
  const entry = sugerenciasCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    sugerenciasCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  sugerenciasCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

router.get(
  '/:alumnoId',
  authenticate,
  authorize('admin', 'coordinador', 'docente'),
  async (req, res) => {
    const alumnoId = toPositiveInt(req.params.alumnoId);
    const materiaId = toPositiveInt(req.query.materiaId);

    if (!alumnoId || !materiaId) {
      return res.status(400).json({ error: 'alumnoId y materiaId son requeridos.' });
    }

    const cacheKey = `${alumnoId}_${materiaId}`;
    const cached = getCached(cacheKey);
    if (cached) return res.status(200).json({ sugerencia: cached });

    try {
      const sugerencia = await generarSugerencia(alumnoId, materiaId);
      if (!sugerencia) {
        return res.status(404).json({ error: 'No hay suficiente información para generar sugerencias.' });
      }
      setCached(cacheKey, sugerencia);
      return res.status(200).json({ sugerencia });
    } catch (error) {
      console.error('Error generando sugerencia:', error.message);
      return res.status(503).json({ error: 'No se pudo generar la sugerencia, intente nuevamente.' });
    }
  },
);

module.exports = router;
