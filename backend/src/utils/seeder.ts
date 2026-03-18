import dotenv from 'dotenv';
dotenv.config();

import { auth, db } from '../config/firebase';

const DEPARTMENTS = ['Computer Science', 'Electronics', 'Mechanical'];
const SUBJECTS = ['Data Structures', 'Operating Systems', 'Database Management', 'Computer Networks', 'Software Engineering'];

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

  // Create classes
  const classIds: string[] = [];
  for (let sem = 1; sem <= 2; sem++) {
    for (const section of ['A', 'B']) {
      const classRef = await db.collection('classes').add({
        name: `CS-${sem}${section}`,
        department: 'Computer Science',
        semester: sem,
        section,
        studentIds: [],
      });
      classIds.push(classRef.id);
      console.log(`Created class: CS-${sem}${section}`);
    }
  }

  // Create students and assign to classes
  let studentIndex = 0;
  for (const classId of classIds) {
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

    await db.collection('classes').doc(classId).update({ studentIds });
  }

  // Create timetable entries
  const days = [1, 2, 3, 4, 5]; // Mon-Fri
  for (let ti = 0; ti < teachers.length; ti++) {
    for (let di = 0; di < days.length; di++) {
      const classIdx = di % classIds.length;
      const subjectIdx = (ti + di) % SUBJECTS.length;

      await db.collection('timetables').add({
        teacherId: teachers[ti],
        classId: classIds[classIdx],
        subject: SUBJECTS[subjectIdx],
        dayOfWeek: days[di],
        startTime: `${9 + ti}:00`,
        endTime: `${10 + ti}:00`,
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

    for (let ci = 0; ci < Math.min(2, classIds.length); ci++) {
      const classDoc = await db.collection('classes').doc(classIds[ci]).get();
      const classData = classDoc.data();
      const studentIds: string[] = classData?.studentIds || [];

      const records = studentIds.map((sid) => ({
        studentId: sid,
        status: Math.random() > 0.2 ? (Math.random() > 0.1 ? 'present' : 'late') : 'absent',
        markedAt: date.toISOString(),
        markedBy: teachers[0],
      }));

      await db.collection('attendance_records').add({
        classId: classIds[ci],
        teacherId: teachers[0],
        subject: SUBJECTS[ci],
        date: dateStr,
        startedAt: date.toISOString(),
        completedAt: date.toISOString(),
        status: 'completed',
        records,
      });
    }
  }

  // Create default config
  await db.collection('config').doc('global').set({
    attendanceThreshold: 75,
    lateMarkMinutes: 15,
    allowOfflineSync: true,
    maxSyncRetries: 3,
  });

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
