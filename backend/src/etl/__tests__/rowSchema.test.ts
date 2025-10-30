import { transformRow } from '../rowSchema';
import { mapColumns } from '../csvMapping';

describe('rowSchema', () => {
  describe('transformRow', () => {
    const createMapping = (headers: string[]) => {
      const mapping: Record<string, number> = {};
      headers.forEach((h, i) => {
        mapping[h] = i;
      });
      return mapping;
    };

    it('should transform valid row with student data', () => {
      const headers = ['alumno_email', 'alumno_nombre', 'genero', 'fecha_nacimiento', 'colegio_tecnico'];
      const row = {
        alumno_email: '0',
        alumno_nombre: '1',
        genero: '2',
        fecha_nacimiento: '3',
        colegio_tecnico: '4',
      };
      const rawRow = {
        '0': 'student@usal.edu.ar',
        '1': 'Juan Pérez',
        '2': 'M',
        '3': '15/05/2005',
        '4': 'Si',
      };
      
      const mapping = createMapping(headers);
      const result = transformRow(rawRow, mapping);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.alumno_email).toBe('student@usal.edu.ar');
        expect(result.data.alumno_nombre).toBe('Juan Pérez');
        expect(result.data.genero).toBe('M');
        expect(result.data.colegio_tecnico).toBe(true);
      }
    });

    it('should parse dates in DD/MM/YYYY format', () => {
      const headers = ['fecha_nacimiento'];
      const row = {
        fecha_nacimiento: '0',
      };
      const rawRow = {
        '0': '30/6/2005',
      };
      
      const mapping = createMapping(headers);
      const result = transformRow(rawRow, mapping);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fecha_nacimiento).toBeInstanceOf(Date);
      }
    });

    it('should parse boolean from S/N', () => {
      const headers = ['colegio_tecnico', 'tutor'];
      const row = {
        colegio_tecnico: '0',
        tutor: '1',
      };
      const rawRow = {
        '0': 'Si',
        '1': 'No',
      };
      
      const mapping = createMapping(headers);
      const result = transformRow(rawRow, mapping);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.colegio_tecnico).toBe(true);
      }
    });

    it('should parse and round grades', () => {
      const headers = ['parcial1', 'parcial2'];
      const row = {
        parcial1: '0',
        parcial2: '1',
      };
      const rawRow = {
        '0': '8.5',
        '1': '7',
      };
      
      const mapping = createMapping(headers);
      const result = transformRow(rawRow, mapping);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parcial1).toBe(9); // Rounded
        expect(result.data.parcial2).toBe(7);
      }
    });

    it('should clamp attendance percentage to 0-100', () => {
      const headers = ['asistencia_pct'];
      const row = {
        asistencia_pct: '0',
      };
      const rawRow = {
        '0': '150', // Should clamp to 100
      };
      
      const mapping = createMapping(headers);
      const result = transformRow(rawRow, mapping);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.asistencia_pct).toBe(100);
      }
    });

    it('should handle missing optional fields', () => {
      const headers = ['alumno_email'];
      const row = {
        alumno_email: '0',
      };
      const rawRow = {
        '0': 'student@usal.edu.ar',
      };
      
      const mapping = createMapping(headers);
      const result = transformRow(rawRow, mapping);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.alumno_email).toBe('student@usal.edu.ar');
        expect(result.data.genero).toBeUndefined();
      }
    });
  });
});


