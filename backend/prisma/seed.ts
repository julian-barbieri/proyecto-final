import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create users for each role
  const users = [
    {
      name: 'Director General',
      email: 'director@usal.edu.ar',
      role: Role.DIRECTOR,
    },
    {
      name: 'Tutor de Ingeniería',
      email: 'tutor@usal.edu.ar',
      role: Role.TUTOR,
    },
    {
      name: 'Prof. Juan Pérez',
      email: 'profesor@usal.edu.ar',
      role: Role.PROFESOR,
    },
    {
      name: 'Julian Francisco Barbieri',
      email: 'j.barbieri@usal.edu.ar',
      role: Role.DIRECTOR,
    },
  ];

  for (const userData of users) {
    await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: userData,
    });
    console.log(`Created/Updated user: ${userData.email} (${userData.role})`);
  }

  // Create subjects: AM1 and SN
  const subjects = [
    {
      name: 'AM1',
      year: 1,
      kind: 'inicial',
      modality: 'presencial',
      hasTutor: true,
    },
    {
      name: 'SN',
      year: 1,
      kind: 'inicial',
      modality: 'presencial',
      hasTutor: false,
    },
  ];

  for (const subjectData of subjects) {
    await prisma.subject.upsert({
      where: { name: subjectData.name },
      update: {},
      create: subjectData,
    });
    console.log(`Created/Updated subject: ${subjectData.name}`);
  }

  // Get subjects for assignments
  const am1Subject = await prisma.subject.findUnique({ where: { name: 'AM1' } });
  const snSubject = await prisma.subject.findUnique({ where: { name: 'SN' } });

  // Create tutors and professors for AM1 and SN
  const tutors = [
    { name: 'Agustina', email: 'agustina.tutor@usal.edu.ar', role: Role.TUTOR },
    { name: 'Pedro', email: 'pedro.tutor@usal.edu.ar', role: Role.TUTOR },
  ];

  const professors = [
    { name: 'Agustina', email: 'agustina.profesor@usal.edu.ar', role: Role.PROFESOR },
    { name: 'Pedro', email: 'pedro.profesor@usal.edu.ar', role: Role.PROFESOR },
    { name: 'Juan', email: 'juan.profesor@usal.edu.ar', role: Role.PROFESOR },
  ];

  for (const tutorData of tutors) {
    const tutor = await prisma.user.upsert({
      where: { email: tutorData.email },
      update: { name: tutorData.name, role: tutorData.role },
      create: tutorData,
    });
    console.log(`Created/Updated tutor: ${tutor.email}`);

    if (am1Subject) {
      await prisma.tutorAssignment.upsert({
        where: {
          tutorId_subjectId: {
            tutorId: tutor.id,
            subjectId: am1Subject.id,
          },
        },
        update: {},
        create: {
          tutorId: tutor.id,
          subjectId: am1Subject.id,
        },
      });
      console.log(`Assigned tutor ${tutor.name} to AM1`);
    }
  }

  for (const profData of professors) {
    const professor = await prisma.user.upsert({
      where: { email: profData.email },
      update: { name: profData.name, role: profData.role },
      create: profData,
    });
    console.log(`Created/Updated professor: ${professor.email}`);

    // Assign to both subjects
    if (am1Subject) {
      await prisma.professorAssignment.upsert({
        where: {
          professorId_subjectId: {
            professorId: professor.id,
            subjectId: am1Subject.id,
          },
        },
        update: {},
        create: {
          professorId: professor.id,
          subjectId: am1Subject.id,
        },
      });
      console.log(`Assigned professor ${professor.name} to AM1`);
    }

    if (snSubject) {
      await prisma.professorAssignment.upsert({
        where: {
          professorId_subjectId: {
            professorId: professor.id,
            subjectId: snSubject.id,
          },
        },
        update: {},
        create: {
          professorId: professor.id,
          subjectId: snSubject.id,
        },
      });
      console.log(`Assigned professor ${professor.name} to SN`);
    }
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

