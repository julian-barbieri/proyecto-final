/**
 * Flexible column mapping for CSV import
 * Supports multiple alias names for each column
 */

export const COLUMN_MAP = {
  // Student info
  alumno_email: ['alumno_email', 'email_alumno', 'email', 'Email', 'EMAIL'],
  alumno_nombre: ['alumno_nombre', 'nombre_alumno', 'nombre', 'Nombre', 'NOMBRE', 'name'],
  genero: ['genero', 'Genero', 'GENERO', 'gender', 'Gender'],
  fecha_nacimiento: [
    'fecha_nacimiento',
    'FechaNacimiento',
    'FECHA_NACIMIENTO',
    'birth_date',
    'birthDate',
  ],
  colegio_tecnico: [
    'colegio_tecnico',
    'ColegioTecnico',
    'COLEGIO_TECNICO',
    'is_technical_hs',
    'technical_high_school',
  ],

  // Subject info
  materia: ['materia', 'Materia', 'MATERIA', 'subject', 'Subject'],
  anio_lectivo: [
    'anio_lectivo',
    'AnioAM1',
    'AnioAM2',
    'AnioLectivo',
    'academic_year',
    'year',
  ],
  profesor: ['profesor', 'ProfesorAM1', 'ProfesorAM2', 'Profesor', 'teacher', 'professor'],
  tutor: ['tutor', 'TutorAM1', 'TutorAM2', 'Tutor', 'tutor_name'],

  // Enrollment info
  asistencia_pct: [
    'asistencia_pct',
    'AsistenciaAM1',
    'AsistenciaAM2',
    'Asistencia',
    'attendance_pct',
    'attendance',
  ],
  recursadas: ['recursadas', 'VecesRecursadaAM1', 'VecesRecursadaAM2', 'VecesRecursada', 'recursadas_count'],
  abandono: ['abandono', 'Abandona', 'ABANDONO', 'dropout', 'dropout_flag'],
  periodo: ['periodo', 'PeriodoAM1', 'PeriodoAM2', 'Periodo', 'period'],
  modalidad: ['modalidad', 'ModalidadAM1', 'ModalidadAM2', 'Modalidad', 'modality'],
  tipo_materia: ['tipo_materia', 'TipoMateriaAM1', 'TipoMateriaAM2', 'TipoMateria', 'kind'],

  // Assessments
  parcial1: ['parcial1', 'Parcial1AM1', 'Parcial1AM2', 'Parcial1', 'parcial_1'],
  parcial2: ['parcial2', 'Parcial2AM1', 'Parcial2AM2', 'Parcial2', 'parcial_2'],
  recup1: ['recup1', 'Recuperatorio1AM1', 'Recuperatorio1AM2', 'Recuperatorio1', 'recuperatorio_1'],
  recup2: ['recup2', 'Recuperatorio2AM1', 'Recuperatorio2AM2', 'Recuperatorio2', 'recuperatorio_2'],
  final1: ['final1', 'Final1AM1', 'Final1AM2', 'Final1', 'final_1'],
  final2: ['final2', 'Final2AM1', 'Final2AM2', 'Final2', 'final_2'],
  final3: ['final3', 'Final3AM1', 'Final3AM2', 'Final3', 'final_3'],
} as const;

export type ColumnKey = keyof typeof COLUMN_MAP;

/**
 * Resolves column index by finding first matching alias in headers
 * @param headers Array of column headers from CSV
 * @param aliases Array of possible alias names for the column
 * @returns Column index (0-based) or -1 if not found
 */
export function resolveColumn(headers: string[], aliases: readonly string[]): number {
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
  
  for (const alias of aliases) {
    const normalizedAlias = alias.trim().toLowerCase();
    const index = normalizedHeaders.indexOf(normalizedAlias);
    if (index !== -1) {
      return index;
    }
  }
  
  return -1;
}

/**
 * Maps all columns from CSV headers
 * @param headers Array of column headers from CSV
 * @returns Object with column keys mapped to indices
 */
export function mapColumns(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  
  for (const [key, aliases] of Object.entries(COLUMN_MAP)) {
    const index = resolveColumn(headers, aliases);
    if (index !== -1) {
      mapping[key] = index;
    }
  }
  
  return mapping;
}


