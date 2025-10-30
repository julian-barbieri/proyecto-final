import { resolveColumn, mapColumns, COLUMN_MAP } from '../csvMapping';

describe('csvMapping', () => {
  describe('resolveColumn', () => {
    it('should find exact match', () => {
      const headers = ['email', 'name', 'age'];
      const aliases = ['email', 'Email', 'EMAIL'];
      expect(resolveColumn(headers, aliases)).toBe(0);
    });

    it('should find case-insensitive match', () => {
      const headers = ['Email', 'Name', 'Age'];
      const aliases = ['email'];
      expect(resolveColumn(headers, aliases)).toBe(0);
    });

    it('should return -1 when not found', () => {
      const headers = ['name', 'age'];
      const aliases = ['email'];
      expect(resolveColumn(headers, aliases)).toBe(-1);
    });

    it('should handle headers with spaces', () => {
      const headers = [' alumno_email ', ' name '];
      const aliases = ['alumno_email'];
      expect(resolveColumn(headers, aliases)).toBe(0);
    });
  });

  describe('mapColumns', () => {
    it('should map common columns', () => {
      const headers = ['alumno_email', 'alumno_nombre', 'genero', 'fecha_nacimiento'];
      const mapping = mapColumns(headers);
      
      expect(mapping.alumno_email).toBe(0);
      expect(mapping.alumno_nombre).toBe(1);
      expect(mapping.genero).toBe(2);
      expect(mapping.fecha_nacimiento).toBe(3);
    });

    it('should map Spanish headers', () => {
      const headers = ['Genero', 'FechaNacimiento', 'ColegioTecnico'];
      const mapping = mapColumns(headers);
      
      expect(mapping.genero).toBe(0);
      expect(mapping.fecha_nacimiento).toBe(1);
      expect(mapping.colegio_tecnico).toBe(2);
    });

    it('should handle CSV with AM1/AM2 columns', () => {
      const headers = ['AnioAM1', 'TutorAM1', 'ProfesorAM1', 'AsistenciaAM1', 'Parcial1AM1'];
      const mapping = mapColumns(headers);
      
      expect(mapping.anio_lectivo).toBe(0);
      expect(mapping.tutor).toBe(1);
      expect(mapping.profesor).toBe(2);
      expect(mapping.asistencia_pct).toBe(3);
      expect(mapping.parcial1).toBe(4);
    });
  });
});


