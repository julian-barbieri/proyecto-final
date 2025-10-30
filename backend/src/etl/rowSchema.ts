import { z } from 'zod';

/**
 * Zod schema for validating CSV row data
 * Handles type transformations (dates, numbers, booleans, etc.)
 */

// Helper to parse date from various formats (DD/MM/YYYY, YYYY-MM-DD, etc.)
const dateParser = (val: string | undefined): Date | null => {
  if (!val || val.trim() === '') return null;
  
  const trimmed = val.trim();
  
  // Try DD/MM/YYYY format (most common in Spanish CSV)
  const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Try YYYY-MM-DD format
  const yyyymmdd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Try native Date parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  return null;
};

// Helper to parse boolean from S/N, Si/No, Yes/No, 1/0
const booleanParser = (val: string | undefined): boolean | null => {
  if (!val || val.trim() === '') return null;
  
  const normalized = val.trim().toLowerCase();
  
  if (['s', 'si', 'yes', 'y', '1', 'true'].includes(normalized)) {
    return true;
  }
  if (['n', 'no', '0', 'false'].includes(normalized)) {
    return false;
  }
  
  return null;
};

// Helper to parse integer (rounds decimals)
const integerParser = (val: string | undefined): number | null => {
  if (!val || val.trim() === '') return null;
  
  const trimmed = val.trim();
  const num = parseFloat(trimmed);
  
  if (isNaN(num)) return null;
  
  return Math.round(num);
};

// Helper to parse float for attendance percentage
const floatParser = (val: string | undefined): number | null => {
  if (!val || val.trim() === '') return null;
  
  const trimmed = val.trim();
  const num = parseFloat(trimmed);
  
  if (isNaN(num)) return null;
  
  return num;
};

// Helper to clamp attendance percentage to 0-100
const clampAttendance = (val: number | null): number | null => {
  if (val === null) return null;
  return Math.max(0, Math.min(100, val));
};

// Helper to normalize string (trim, lowercase)
const normalizeString = (val: string | undefined): string | null => {
  if (!val) return null;
  const trimmed = val.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Schema for a processed CSV row
 */
export const csvRowSchema = z.object({
  // Student fields
  alumno_email: z.string().email().optional(),
  alumno_nombre: z.string().min(1).optional(),
  genero: z.enum(['M', 'F', 'X']).optional().nullable(),
  fecha_nacimiento: z.date().nullable().optional(),
  colegio_tecnico: z.boolean().nullable().optional(),

  // Subject fields
  materia: z.string().min(1).optional(),
  anio_lectivo: z.number().int().positive().optional(),
  profesor: z.string().optional().nullable(),
  tutor: z.string().optional().nullable(),
  periodo: z.string().optional().nullable(),
  modalidad: z.string().optional().nullable(),
  tipo_materia: z.string().optional().nullable(),

  // Enrollment fields
  asistencia_pct: z.number().min(0).max(100).nullable().optional(),
  recursadas: z.number().int().min(0).nullable().optional(),
  abandono: z.boolean().nullable().optional(),

  // Assessment fields
  parcial1: z.number().int().min(1).max(10).nullable().optional(),
  parcial2: z.number().int().min(1).max(10).nullable().optional(),
  recup1: z.number().int().min(1).max(10).nullable().optional(),
  recup2: z.number().int().min(1).max(10).nullable().optional(),
  final1: z.number().int().min(1).max(10).nullable().optional(),
  final2: z.number().int().min(1).max(10).nullable().optional(),
  final3: z.number().int().min(1).max(10).nullable().optional(),
});

export type CsvRow = z.infer<typeof csvRowSchema>;

/**
 * Transforms raw CSV row object to validated schema
 * @param subjectSuffix Optional suffix (AM1 or AM2) to extract subject-specific columns
 */
export function transformRow(
  rawRow: Record<string, string>,
  columnMapping: Record<string, number>,
  subjectSuffix?: 'AM1' | 'AM2'
): z.SafeParseReturnType<any, CsvRow> {
  const getValue = (key: string): string | undefined => {
    // Map of base keys to their column names with AM1/AM2 suffix
    const suffixColumnMap: Record<string, string> = {
      'anio_lectivo': 'Anio',
      'profesor': 'Profesor',
      'tutor': 'Tutor',
      'asistencia_pct': 'Asistencia',
      'recursadas': 'VecesRecursada',
      'periodo': 'Periodo',
      'modalidad': 'Modalidad',
      'tipo_materia': 'TipoMateria',
      'parcial1': 'Parcial1',
      'parcial2': 'Parcial2',
      'recup1': 'Recuperatorio1',
      'recup2': 'Recuperatorio2',
      'final1': 'Final1',
      'final2': 'Final2',
      'final3': 'Final3',
    };

    // If subjectSuffix is provided, try to find column with suffix
    if (subjectSuffix && suffixColumnMap[key]) {
      const columnNameWithSuffix = `${suffixColumnMap[key]}${subjectSuffix}`;
      // Try exact match first
      if (rawRow[columnNameWithSuffix] !== undefined) {
        return rawRow[columnNameWithSuffix];
      }
      // Try case-insensitive search
      const rowKeys = Object.keys(rawRow);
      const matchingKey = rowKeys.find(k => k.toLowerCase() === columnNameWithSuffix.toLowerCase());
      if (matchingKey) {
        return rawRow[matchingKey];
      }
    }
    
    // Fall back to column mapping
    const index = columnMapping[key];
    if (index === undefined || index === -1) return undefined;
    const values = Object.values(rawRow);
    return values[index];
  };

  const transformed: any = {};

  // Student fields
  const email = normalizeString(getValue('alumno_email'));
  if (email) transformed.alumno_email = email;

  const nombre = normalizeString(getValue('alumno_nombre'));
  if (nombre) transformed.alumno_nombre = nombre;

  const genero = normalizeString(getValue('genero'));
  if (genero && ['m', 'f', 'x'].includes(genero.toLowerCase())) {
    transformed.genero = genero.toUpperCase();
  }

  const fechaNac = dateParser(getValue('fecha_nacimiento'));
  if (fechaNac) transformed.fecha_nacimiento = fechaNac;

  const colegioTec = booleanParser(getValue('colegio_tecnico'));
  if (colegioTec !== null) transformed.colegio_tecnico = colegioTec;

  // Subject fields
  // If subjectSuffix is provided, use it as the subject name
  if (subjectSuffix) {
    transformed.materia = subjectSuffix;
  } else {
    const materia = normalizeString(getValue('materia'));
    if (materia) transformed.materia = materia;
  }

  const anio = integerParser(getValue('anio_lectivo'));
  if (anio !== null && anio > 0) transformed.anio_lectivo = anio;

  const profesor = normalizeString(getValue('profesor'));
  if (profesor) transformed.profesor = profesor;

  const tutor = normalizeString(getValue('tutor'));
  if (tutor) transformed.tutor = tutor;

  const periodo = normalizeString(getValue('periodo'));
  if (periodo) transformed.periodo = periodo;

  const modalidad = normalizeString(getValue('modalidad'));
  if (modalidad) transformed.modalidad = modalidad;

  const tipoMateria = normalizeString(getValue('tipo_materia'));
  if (tipoMateria) transformed.tipo_materia = tipoMateria;

  // Enrollment fields
  const asistencia = floatParser(getValue('asistencia_pct'));
  if (asistencia !== null) {
    transformed.asistencia_pct = clampAttendance(asistencia);
  }

  const recursadas = integerParser(getValue('recursadas'));
  if (recursadas !== null && recursadas >= 0) {
    transformed.recursadas = recursadas;
  }

  const abandono = booleanParser(getValue('abandono'));
  if (abandono !== null) transformed.abandono = abandono;

  // Assessment fields (only if between 1-10)
  const assessments = [
    'parcial1',
    'parcial2',
    'recup1',
    'recup2',
    'final1',
    'final2',
    'final3',
  ];

  for (const key of assessments) {
    const grade = integerParser(getValue(key));
    if (grade !== null && grade >= 1 && grade <= 10) {
      transformed[key] = grade;
    }
  }

  return csvRowSchema.safeParse(transformed);
}


