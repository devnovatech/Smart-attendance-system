import dotenv from 'dotenv';
dotenv.config();

import { auth, db } from '../config/firebase';

const DEPARTMENTS = ['Computer Science', 'Electronics', 'Mechanical'];
const COURSES = [
  { name: 'Data Structures', code: 'CS201', semester: 1 },
  { name: 'Operating Systems', code: 'CS301', semester: 2 },
  { name: 'Database Management', code: 'CS302', semester: 2 },
  { name: 'Computer Networks', code: 'CS401', semester: 2 },
  { name: 'Software Engineering', code: 'CS402', semester: 1 },
];

async function seed() {
  console.log('Starting seed...');

  // Create admin user
  const adminUser = await createUser('admin@smartattendance.com', 'Admin@123', 'System Admin', 'admin');
  console.log(`Created admin: ${adminUser.uid}`);

  // Create teachers
  const teachers: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const teacher = await createUser(
      `teacher${i}@smartattendance.com`,
      'Teacher@123',
      `Teacher ${i}`,
      'teacher',
      { department: DEPARTMENTS[i - 1] }
    );
    teachers.push(teacher.uid);
    console.log(`Created teacher: ${teacher.uid}`);
  }

  // Create courses
  const courseRecords: { id: string; name: string; semester: number }[] = [];
  for (const c of COURSES) {
    const existing = await db.collection('courses').where('code', '==', c.code).get();
    if (!existing.empty) {
      const doc = existing.docs[0];
      courseRecords.push({ id: doc.id, name: c.name, semester: c.semester });
      console.log(`Course already exists: ${c.code}`);
      continue;
    }
    const ref = await db.collection('courses').add({
      name: c.name,
      code: c.code,
      department: 'Computer Science',
      semester: c.semester,
      credits: 4,
    });
    courseRecords.push({ id: ref.id, name: c.name, semester: c.semester });
    console.log(`Created course: ${c.code}`);
  }

  // Create classes (with courseIds matching the semester)
  const classRecords: { id: string; semester: number; courseIds: string[] }[] = [];
  for (let sem = 1; sem <= 2; sem++) {
    for (const section of ['A', 'B']) {
      const courseIdsForSem = courseRecords.filter((c) => c.semester === sem).map((c) => c.id);
      const classRef = await db.collection('classes').add({
        name: `CS-${sem}${section}`,
        department: 'Computer Science',
        semester: sem,
        section,
        academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        studentIds: [],
        courseIds: courseIdsForSem,
      });
      classRecords.push({ id: classRef.id, semester: sem, courseIds: courseIdsForSem });
      console.log(`Created class: CS-${sem}${section}`);
    }
  }

  // Create students and assign to classes
  let studentIndex = 0;
  for (const cls of classRecords) {
    const studentIds: string[] = [];
    for (let i = 1; i <= 10; i++) {
      studentIndex++;
      const rollNum = String(studentIndex).padStart(3, '0');
      const student = await createUser(
        `student${studentIndex}@smartattendance.com`,
        'Student@123',
        `Student ${rollNum}`,
        'student',
        {
          rollNumber: `CS${rollNum}`,
          studentId: `STU${rollNum}`,
          department: 'Computer Science',
        }
      );
      studentIds.push(student.uid);
      console.log(`Created student: STU${rollNum}`);
    }

    await db.collection('classes').doc(cls.id).update({ studentIds });
  }

  // Create timetable entries (one per teacher per weekday)
  const days = [1, 2, 3, 4, 5]; // Mon-Fri
  for (let ti = 0; ti < teachers.length; ti++) {
    for (let di = 0; di < days.length; di++) {
      const cls = classRecords[di % classRecords.length];
      if (cls.courseIds.length === 0) continue;
      const courseId = cls.courseIds[(ti + di) % cls.courseIds.length];
      const course = courseRecords.find((c) => c.id === courseId);

      await db.collection('timetables').add({
        teacherId: teachers[ti],
        classId: cls.id,
        courseId,
        subject: course?.name || 'Course',
        dayOfWeek: days[di],
        startTime: `${String(9 + ti).padStart(2, '0')}:00`,
        endTime: `${String(10 + ti).padStart(2, '0')}:00`,
        room: `Room ${100 + ti * 10 + di}`,
      });
    }
  }

  // Create sample attendance records
  const today = new Date();
  for (let daysAgo = 1; daysAgo <= 5; daysAgo++) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().split('T')[0];

    for (let ci = 0; ci < Math.min(2, classRecords.length); ci++) {
      const cls = classRecords[ci];
      const classDoc = await db.collection('classes').doc(cls.id).get();
      const classData = classDoc.data();
      const studentIds: string[] = classData?.studentIds || [];
      const courseId = cls.courseIds[0];
      const course = courseRecords.find((c) => c.id === courseId);

      const records = studentIds.map((sid) => ({
        studentId: sid,
        status: Math.random() > 0.2 ? (Math.random() > 0.1 ? 'present' : 'late') : 'absent',
        markedAt: date.toISOString(),
        markedBy: teachers[0],
      }));

      await db.collection('attendance_records').add({
        classId: cls.id,
        teacherId: teachers[0],
        courseId,
        subject: course?.name || 'Course',
        date: dateStr,
        startedAt: date.toISOString(),
        completedAt: date.toISOString(),
        status: 'completed',
        records,
      });
    }
  }

  // Create default config (now including departments)
  await db.collection('config').doc('global').set(
    {
      attendanceThreshold: 75,
      lateMarkMinutes: 15,
      allowOfflineSync: true,
      maxSyncRetries: 3,
      departments: DEPARTMENTS,
    },
    { merge: true }
  );

  console.log('Seed completed successfully!');
  console.log('\nTest Accounts:');
  console.log('Admin: admin@smartattendance.com / Admin@123');
  console.log('Teacher: teacher1@smartattendance.com / Teacher@123');
  console.log('Student: student1@smartattendance.com / Student@123');
  process.exit(0);
}

async function createUser(
  email: string,
  password: string,
  displayName: string,
  role: string,
  extra: Record<string, string> = {}
) {
  try {
    // Try to get existing user
    const existing = await auth.getUserByEmail(email).catch(() => null);
    if (existing) {
      console.log(`User ${email} already exists, updating...`);
      await auth.setCustomUserClaims(existing.uid, { role });
      await db.collection('users').doc(existing.uid).set(
        { email, displayName, role, ...extra, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      return existing;
    }

    const userRecord = await auth.createUser({ email, password, displayName });
    await auth.setCustomUserClaims(userRecord.uid, { role });
    await db.collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      role,
      ...extra,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return userRecord;
  } catch (error) {
    console.error(`Error creating user ${email}:`, error);
    throw error;
  }
}

seed().catch(console.error);
