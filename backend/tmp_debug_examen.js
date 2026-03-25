const axios = require('axios');
const db = require('./src/db/database');
const { calcularVariablesExamen } = require('./src/services/prediction-variables.service');

const ag = db.prepare("SELECT id, username, nombre_completo FROM users WHERE username='agustina.romero'").get();
console.log('agustina', ag);

(async () => {
  try {
    const vars = calcularVariablesExamen(ag.id, 1, 'Parcial', 1, 2026);
    const { _meta, ...clean } = vars;
    console.log('vars sample', { Materia: clean.Materia, TipoExamen: clean.TipoExamen, Anio: clean.Anio, Asistencia: clean.Asistencia });
    const response = await axios.post('http://localhost:8000/predict/examen', [clean], { timeout: 15000 });
    console.log('ai ok', response.data);
  } catch (e) {
    console.log('err code', e.code);
    console.log('err status', e.response?.status);
    console.log('err data', e.response?.data);
    console.log('err message', e.message);
  }
})();
