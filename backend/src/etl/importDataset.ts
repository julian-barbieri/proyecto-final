import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { PrismaClient, Role, AssessmentType } from '@prisma/client';
import { mapColumns } from './csvMapping';
import { transformRow, CsvRow } from './rowSchema';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

interface ImportReport {
  rows_read: number;
  rows_ok: number;
  rows_error: number;
  users_upserted: number;
  subjects_upserted: number;
  enrollments_upserted: number;
  assessments_created: number;
  tutor_assignments_created: number;
  professor_assignments_created: number;
  error_samples: Array<{ row: number; error: string; data?: any }>;
  warnings: Array<{ row: number; warning: string }>;
}

/**
 * Normalizes email - creates placeholder email if name is provided
 */
function normalizeEmail(email: string | undefined, name: string | undefined, role: Role): string {
  if (email && email.includes('@')) {
    return email.toLowerCase().trim();
  }
  
  // Create synthetic email for tutors/professors without email
  if (name) {
    const normalizedName = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 30);
    return `${normalizedName}@example.local`;
  }
  
  throw new Error('Cannot create user without email or name');
}

/**
 * Normalizes name for synthetic email generation
 */
function normalizeNameForEmail(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 30);
}

/**
 * Creates or gets user by email
 */
async function upsertUser(data: { email: string; name: string; role: Role; gender?: string | null; birthDate?: Date | null; isTechnicalHS?: boolean | null }) {
  return prisma.user.upsert({
    where: { email: data.email },
    update: {
      name: data.name,
      role: data.role,
      gender: data.gender,
      birthDate: data.birthDate,
      isTechnicalHS: data.isTechnicalHS,
    },
    create: data,
  });
}

/**
 * Creates or gets subject by name
 */
async function upsertSubject(data: {
  name: string;
  year?: number | null;
  kind?: string | null;
  modality?: string | null;
  hasTutor?: boolean | null;
}) {
  return prisma.subject.upsert({
    where: { name: data.name },
    update: {
      year: data.year,
      kind: data.kind,
      modality: data.modality,
      hasTutor: data.hasTutor,
    },
    create: data,
  });
}

/**
 * Creates or gets tutor assignment
 */
async function upsertTutorAssignment(tutorId: string, subjectId: string) {
  return prisma.tutorAssignment.upsert({
    where: { tutorId_subjectId: { tutorId, subjectId } },
    update: {},
    create: { tutorId, subjectId },
  });
}

/**
 * Creates or gets professor assignment
 */
async function upsertProfessorAssignment(professorId: string, subjectId: string) {
  return prisma.professorAssignment.upsert({
    where: { professorId_subjectId: { professorId, subjectId } },
    update: {},
    create: { professorId, subjectId },
  });
}

/**
 * Gets or creates user by name/email for tutor/professor
 */
async function getOrCreateStaff(
  name: string | null | undefined,
  email: string | undefined,
  role: Role,
  allowedDomain: string
): Promise<string> {
  if (!name) {
    throw new Error(`Cannot create ${role} without name`);
  }

  let staffEmail: string;
  
  if (email && email.includes('@')) {
    staffEmail = email.toLowerCase().trim();
  } else {
    // Generate synthetic email
    const normalizedName = normalizeNameForEmail(name);
    staffEmail = `${normalizedName}@example.local`;
  }

  const user = await upsertUser({
    email: staffEmail,
    name: name,
    role: role,
  });

  return user.id;
}

/**
 * Processes a single CSV row
 */
async function processRow(
  row: CsvRow,
  rowIndex: number,
  report: ImportReport,
  allowedDomain: string
): Promise<void> {
  try {
    // Validate required fields - if no email/name, generate synthetic from row index
    let studentEmail: string;
    let studentName: string;
    
    if (row.alumno_email) {
      studentEmail = row.alumno_email.toLowerCase().trim();
      studentName = row.alumno_nombre || `Estudiante ${rowIndex + 1}`;
    } else if (row.alumno_nombre) {
      // Generate synthetic email from name
      const normalizedName = normalizeNameForEmail(row.alumno_nombre);
      studentEmail = `${normalizedName}_${rowIndex + 1}@synthetic.local`;
      studentName = row.alumno_nombre;
    } else {
      // Generate completely synthetic identifier
      studentEmail = `estudiante_${rowIndex + 1}@synthetic.local`;
      studentName = `Estudiante ${rowIndex + 1}`;
      report.warnings.push({
        row: rowIndex + 1,
        warning: 'No student email or name found, generated synthetic identifier',
      });
    }

    if (!row.materia) {
      report.rows_error++;
      report.error_samples.push({
        row: rowIndex + 1,
        error: 'Missing subject name',
      });
      return;
    }

    // Upsert student
    try {

      // Validate domain if email is provided
      if (row.alumno_email && !row.alumno_email.toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`)) {
        report.warnings.push({
          row: rowIndex + 1,
          warning: `Student email domain not matching allowed domain: ${row.alumno_email}`,
        });
      }

      const student = await upsertUser({
        email: studentEmail,
        name: studentName,
        role: Role.ALUMNO,
        gender: row.genero || null,
        birthDate: row.fecha_nacimiento || null,
        isTechnicalHS: row.colegio_tecnico ?? null,
      });
      report.users_upserted++;
    } catch (error) {
      report.rows_error++;
      report.error_samples.push({
        row: rowIndex + 1,
        error: `Failed to create student: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { email: row.alumno_email, name: row.alumno_nombre },
      });
      return;
    }

    // Upsert subject
    const subject = await upsertSubject({
      name: row.materia,
      year: row.anio_lectivo || null,
      kind: row.tipo_materia || null,
      modality: row.modalidad || null,
      hasTutor: row.materia === 'AM1' || row.tutor ? true : null,
    });
    report.subjects_upserted++;

    // Handle tutor assignment
    if (row.tutor) {
      try {
        const tutorId = await getOrCreateStaff(row.tutor, undefined, Role.TUTOR, allowedDomain);
        await upsertTutorAssignment(tutorId, subject.id);
        report.tutor_assignments_created++;
      } catch (error) {
        report.warnings.push({
          row: rowIndex + 1,
          warning: `Failed to create tutor assignment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    // Handle professor assignment
    if (row.profesor) {
      try {
        const professorId = await getOrCreateStaff(row.profesor, undefined, Role.PROFESOR, allowedDomain);
        await upsertProfessorAssignment(professorId, subject.id);
        report.professor_assignments_created++;
      } catch (error) {
        report.warnings.push({
          row: rowIndex + 1,
          warning: `Failed to create professor assignment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    // Upsert enrollment
    if (!row.anio_lectivo) {
      report.warnings.push({
        row: rowIndex + 1,
        warning: 'Missing academic year, using current year',
      });
    }

    const academicYear = row.anio_lectivo || new Date().getFullYear();
    
    const student = await prisma.user.findUnique({
      where: { email: studentEmail },
    });

    if (!student) {
      throw new Error('Student not found after creation');
    }

    const enrollment = await prisma.enrollment.upsert({
      where: {
        studentId_subjectId_academicYear: {
          studentId: student.id,
          subjectId: subject.id,
          academicYear: academicYear,
        },
      },
      update: {
        recursadas: row.recursadas ?? 0,
        attendancePct: row.asistencia_pct ?? null,
        dropoutFlag: row.abandono ?? null,
      },
      create: {
        studentId: student.id,
        subjectId: subject.id,
        academicYear: academicYear,
        recursadas: row.recursadas ?? 0,
        attendancePct: row.asistencia_pct ?? null,
        dropoutFlag: row.abandono ?? null,
      },
    });
    report.enrollments_upserted++;

    // Create assessments
    const assessmentMap: Record<string, AssessmentType> = {
      parcial1: AssessmentType.PARCIAL1,
      parcial2: AssessmentType.PARCIAL2,
      recup1: AssessmentType.RECUP1,
      recup2: AssessmentType.RECUP2,
      final1: AssessmentType.FINAL1,
      final2: AssessmentType.FINAL2,
      final3: AssessmentType.FINAL3,
    };

    for (const [key, assessmentType] of Object.entries(assessmentMap)) {
      const grade = row[key as keyof CsvRow] as number | null | undefined;
      if (grade !== null && grade !== undefined && grade >= 1 && grade <= 10) {
        await prisma.assessment.upsert({
          where: {
            enrollmentId_kind: {
              enrollmentId: enrollment.id,
              kind: assessmentType,
            },
          },
          update: {
            grade: grade,
          },
          create: {
            enrollmentId: enrollment.id,
            kind: assessmentType,
            grade: grade,
          },
        });
        report.assessments_created++;
      }
    }

    report.rows_ok++;
  } catch (error) {
    report.rows_error++;
    report.error_samples.push({
      row: rowIndex + 1,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: row,
    });
  }
}

/**
 * Main import function
 */
async function importDataset(csvPath: string, delimiter: string = ',') {
  const report: ImportReport = {
    rows_read: 0,
    rows_ok: 0,
    rows_error: 0,
    users_upserted: 0,
    subjects_upserted: 0,
    enrollments_upserted: 0,
    assessments_created: 0,
    tutor_assignments_created: 0,
    professor_assignments_created: 0,
    error_samples: [],
    warnings: [],
  };

  try {
    logger.info('Starting CSV import', { csvPath, delimiter });

    // Resolve CSV path
    const resolvedPath = path.isAbsolute(csvPath)
      ? csvPath
      : path.resolve(process.cwd(), csvPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`CSV file not found: ${resolvedPath}`);
    }

    // Read and parse CSV
    const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
    
    // Detect delimiter if semicolon is present
    const actualDelimiter = fileContent.includes(';') && !delimiter.includes(';') ? ';' : delimiter;

    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: actualDelimiter,
      relax_column_count: true,
      trim: true,
    }) as Record<string, string>[];

    if (records.length === 0) {
      throw new Error('CSV file is empty or has no data rows');
    }

    // Map columns
    const headers = Object.keys(records[0]);
    const columnMapping = mapColumns(headers);

    logger.info('CSV parsed', {
      totalRows: records.length,
      headersCount: headers.length,
      mappedColumns: Object.keys(columnMapping).length,
    });

    // Process each row
    const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || 'usal.edu.ar';

    // Detect if CSV has AM1/AM2 format by checking for AM1 or AM2 columns
    const hasAM1 = headers.some(h => h.includes('AM1'));
    const hasAM2 = headers.some(h => h.includes('AM2'));
    const useSubjectSuffixes = hasAM1 || hasAM2;

    for (let i = 0; i < records.length; i++) {
      report.rows_read++;

      const row = records[i];
      
      // Process row for each subject (AM1 and/or AM2) or as single subject
      const subjectsToProcess: Array<'AM1' | 'AM2' | undefined> = [];
      
      if (useSubjectSuffixes) {
        // Check which subjects have data in this row (case-insensitive)
        const rowKeys = Object.keys(row).map(k => k.toLowerCase());
        if (hasAM1) {
          const hasAM1Data = rowKeys.some(k => k.includes('am1')) && 
            (rowKeys.some(k => k.includes('anioam1')) || 
             rowKeys.some(k => k.includes('asistenciaam1')) || 
             rowKeys.some(k => k.includes('parcial1am1')));
          if (hasAM1Data) {
            subjectsToProcess.push('AM1');
          }
        }
        if (hasAM2) {
          const hasAM2Data = rowKeys.some(k => k.includes('am2')) && 
            (rowKeys.some(k => k.includes('anioam2')) || 
             rowKeys.some(k => k.includes('asistenciaam2')) || 
             rowKeys.some(k => k.includes('parcial1am2')));
          if (hasAM2Data) {
            subjectsToProcess.push('AM2');
          }
        }
      } else {
        // No AM1/AM2 format, process as single row
        subjectsToProcess.push(undefined);
      }

      // If no subjects found, still try to process once
      if (subjectsToProcess.length === 0) {
        subjectsToProcess.push(undefined);
      }

      // Process row for each subject
      for (const subjectSuffix of subjectsToProcess) {
        const transformed = transformRow(row, columnMapping, subjectSuffix);

        if (!transformed.success) {
          report.rows_error++;
          report.error_samples.push({
            row: i + 1,
            error: `Validation failed: ${transformed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
            data: row,
          });
          continue;
        }

        // Skip if no subject name was found
        if (!transformed.data.materia) {
          // Only report error if this was the first attempt
          if (subjectSuffix === undefined || subjectsToProcess.length === 1) {
            report.rows_error++;
            report.error_samples.push({
              row: i + 1,
              error: 'Missing subject name',
              data: row,
            });
          }
          continue;
        }

        await processRow(transformed.data, i, report, allowedDomain);
      }

      // Log progress every 50 rows
      if ((i + 1) % 50 === 0) {
        logger.info('Import progress', {
          processed: i + 1,
          total: records.length,
          ok: report.rows_ok,
          errors: report.rows_error,
        });
      }
    }

    // Limit error samples to 20
    if (report.error_samples.length > 20) {
      report.error_samples = report.error_samples.slice(0, 20);
    }

    logger.info('Import completed', {
      rows_read: report.rows_read,
      rows_ok: report.rows_ok,
      rows_error: report.rows_error,
      users_upserted: report.users_upserted,
      enrollments_upserted: report.enrollments_upserted,
      assessments_created: report.assessments_created,
    });

    return report;
  } catch (error) {
    logger.error('Import failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse --file argument
  let csvPath = process.env.DATASET_CSV || './data/dataset_alumnos.csv';
  let delimiter = process.env.CSV_DELIMITER || ',';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      csvPath = args[i + 1];
      i++;
    } else if (args[i] === '--delimiter' && args[i + 1]) {
      delimiter = args[i + 1];
      i++;
    }
  }

  try {
    const report = await importDataset(csvPath, delimiter);

    // Write report to JSON file
    const reportPath = path.resolve(process.cwd(), 'import_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log('\n=== Import Report ===');
    console.log(`Rows read: ${report.rows_read}`);
    console.log(`Rows OK: ${report.rows_ok}`);
    console.log(`Rows with errors: ${report.rows_error}`);
    console.log(`Users upserted: ${report.users_upserted}`);
    console.log(`Subjects upserted: ${report.subjects_upserted}`);
    console.log(`Enrollments upserted: ${report.enrollments_upserted}`);
    console.log(`Assessments created: ${report.assessments_created}`);
    console.log(`Tutor assignments created: ${report.tutor_assignments_created}`);
    console.log(`Professor assignments created: ${report.professor_assignments_created}`);
    console.log(`\nReport saved to: ${reportPath}`);

    if (report.error_samples.length > 0) {
      console.log(`\nFirst ${report.error_samples.length} errors:`);
      report.error_samples.forEach((err) => {
        console.log(`  Row ${err.row}: ${err.error}`);
      });
    }

    if (report.warnings.length > 0) {
      console.log(`\nWarnings: ${report.warnings.length}`);
    }

    process.exit(report.rows_error > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { importDataset, ImportReport };

