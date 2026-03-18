import { Request, Response } from 'express';
import { auth, db } from '../config/firebase';
import { User, AttendanceEntry, Subject, Timetable } from '../types';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

// ---- User Management ----

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const role = req.query.role as string;

    let query: FirebaseFirestore.Query = db.collection('users');
    if (role) query = query.where('role', '==', role);

    // Get all docs first (avoid .count() which may not be supported)
    const allSnapshot = await query.get();
    const total = allSnapshot.size;

    // Manual pagination from the full result
    const allDocs = allSnapshot.docs;
    const startIdx = (page - 1) * limit;
    const paginatedDocs = allDocs.slice(startIdx, startIdx + limit);

    const users = paginatedDocs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({
      success: true,
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, displayName, role, rollNumber, studentId, department } = req.body;

    const userRecord = await auth.createUser({ email, password, displayName });
    await auth.setCustomUserClaims(userRecord.uid, { role });

    const userData: Omit<User, 'uid'> = {
      email,
      displayName,
      role,
      rollNumber,
      studentId,
      department,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(userRecord.uid).set(userData);

    await db.collection('attendance_logs').add({
      action: 'CREATE_USER',
      userId: req.user!.uid,
      details: `Created user ${displayName} (${email}) with role ${role}`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      data: { uid: userRecord.uid, ...userData },
    });
  } catch (error: unknown) {
    console.error('createUser error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create user';
    res.status(500).json({ success: false, error: message });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const userDoc = await db.collection('users').doc(id).get();
    if (!userDoc.exists) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (updates.role) {
      await auth.setCustomUserClaims(id, { role: updates.role });
    }

    if (updates.displayName) {
      await auth.updateUser(id, { displayName: updates.displayName });
    }

    await db.collection('users').doc(id).update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: { id, ...updates } });
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await auth.deleteUser(id);
    await db.collection('users').doc(id).delete();

    await db.collection('attendance_logs').add({
      action: 'DELETE_USER',
      userId: req.user!.uid,
      details: `Deleted user ${id}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
};

// ---- Reports ----

export const getReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const classId = req.query.classId as string | undefined;

    // Simple query — avoid compound orderBy + inequality on different fields
    let snapshot;
    if (classId) {
      snapshot = await db
        .collection('attendance_records')
        .where('classId', '==', classId)
        .where('status', '==', 'completed')
        .get();
    } else {
      snapshot = await db
        .collection('attendance_records')
        .where('status', '==', 'completed')
        .get();
    }

    // Filter and sort in memory (avoids Firestore composite index requirements)
    let reportData = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const records: AttendanceEntry[] = data.records || [];
        return {
          id: doc.id,
          classId: data.classId as string,
          subject: data.subject as string,
          date: data.date as string,
          teacherId: data.teacherId as string,
          totalStudents: records.length,
          present: records.filter((r) => r.status === 'present').length,
          absent: records.filter((r) => r.status === 'absent').length,
          late: records.filter((r) => r.status === 'late').length,
          percentage:
            records.length > 0
              ? Math.round(
                  (records.filter((r) => r.status === 'present' || r.status === 'late').length /
                    records.length) *
                    100
                )
              : 0,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    // Apply date filters in memory
    if (startDate) reportData = reportData.filter((r) => r.date >= startDate);
    if (endDate) reportData = reportData.filter((r) => r.date <= endDate);

    const total = reportData.length;
    const paginatedData = reportData.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: paginatedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalSessions: total,
        averageAttendance:
          total > 0
            ? Math.round(reportData.reduce((sum, r) => sum + r.percentage, 0) / total)
            : 0,
      },
    });
  } catch (error) {
    console.error('getReports error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate reports' });
  }
};

export const exportExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const snapshot = await db
      .collection('attendance_records')
      .where('status', '==', 'completed')
      .get();

    let docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (startDate) docs = docs.filter((d: Record<string, unknown>) => (d.date as string) >= startDate);
    if (endDate) docs = docs.filter((d: Record<string, unknown>) => (d.date as string) <= endDate);

    const rows: Record<string, unknown>[] = [];
    for (const data of docs) {
      for (const record of ((data as Record<string, unknown>).records as Record<string, string>[]) || []) {
        const rec = record;
        let studentName = 'Unknown';
        let rollNumber = '';
        let studentIdVal = '';
        try {
          const studentDoc = await db.collection('users').doc(rec.studentId).get();
          const sd = studentDoc.data();
          if (sd) {
            studentName = sd.displayName || 'Unknown';
            rollNumber = sd.rollNumber || '';
            studentIdVal = sd.studentId || '';
          }
        } catch { /* skip */ }

        rows.push({
          Date: (data as Record<string, unknown>).date,
          Subject: (data as Record<string, unknown>).subject,
          'Student Name': studentName,
          'Roll Number': rollNumber,
          'Student ID': studentIdVal,
          Status: rec.status,
          'Marked At': rec.markedAt,
        });
      }
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Message: 'No data' }]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('exportExcel error:', error);
    res.status(500).json({ success: false, error: 'Failed to export Excel' });
  }
};

export const exportPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const snapshot = await db
      .collection('attendance_records')
      .where('status', '==', 'completed')
      .get();

    let docs = snapshot.docs;
    if (startDate) docs = docs.filter((d) => (d.data().date as string) >= startDate);
    if (endDate) docs = docs.filter((d) => (d.data().date as string) <= endDate);

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.pdf');
    doc.pipe(res);

    doc.fontSize(20).fillColor('#B40808').text('Smart Attendance System', { align: 'center' });
    doc.fontSize(14).fillColor('#333').text('Attendance Report', { align: 'center' });
    doc.moveDown();

    if (startDate || endDate) {
      doc.fontSize(10).text(`Period: ${startDate || 'Start'} to ${endDate || 'End'}`, { align: 'center' });
      doc.moveDown();
    }

    for (const docSnapshot of docs) {
      const data = docSnapshot.data();
      const records: AttendanceEntry[] = data.records || [];
      const present = records.filter((r) => r.status === 'present' || r.status === 'late').length;

      doc.fontSize(12).fillColor('#B40808').text(`${data.subject} - ${data.date}`);
      doc.fontSize(10).fillColor('#333').text(
        `Present: ${present}/${records.length} (${records.length > 0 ? Math.round((present / records.length) * 100) : 0}%)`
      );
      doc.moveDown(0.5);
    }

    doc.end();
  } catch (error) {
    console.error('exportPdf error:', error);
    res.status(500).json({ success: false, error: 'Failed to export PDF' });
  }
};

// ---- Config ----

export const getConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const configDoc = await db.collection('config').doc('global').get();

    if (!configDoc.exists) {
      const defaultConfig = {
        attendanceThreshold: 75,
        lateMarkMinutes: 15,
        allowOfflineSync: true,
        maxSyncRetries: 3,
      };
      await db.collection('config').doc('global').set(defaultConfig);
      res.json({ success: true, data: defaultConfig });
      return;
    }

    res.json({ success: true, data: configDoc.data() });
  } catch (error) {
    console.error('getConfig error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch config' });
  }
};

export const updateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const updates = req.body;

    await db.collection('config').doc('global').set(updates, { merge: true });

    await db.collection('attendance_logs').add({
      action: 'UPDATE_CONFIG',
      userId: req.user!.uid,
      details: `Updated config: ${JSON.stringify(updates)}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: updates });
  } catch (error) {
    console.error('updateConfig error:', error);
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
};

// ---- Subject Management ----

export const getSubjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const department = req.query.department as string | undefined;
    const semester = req.query.semester as string | undefined;

    let query: FirebaseFirestore.Query = db.collection('subjects');
    if (department) query = query.where('department', '==', department);
    if (semester) query = query.where('semester', '==', parseInt(semester));

    const snapshot = await query.get();
    const subjects = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, data: subjects });
  } catch (error) {
    console.error('getSubjects error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subjects' });
  }
};

export const createSubject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, code, department, semester, credits } = req.body;

    // Check for duplicate code
    const existing = await db.collection('subjects').where('code', '==', code).get();
    if (!existing.empty) {
      res.status(400).json({ success: false, error: 'Subject code already exists' });
      return;
    }

    const subjectData: Omit<Subject, 'id'> = {
      name,
      code,
      department,
      semester,
      credits,
    };

    const docRef = await db.collection('subjects').add(subjectData);

    await db.collection('attendance_logs').add({
      action: 'CREATE_SUBJECT',
      userId: req.user!.uid,
      details: `Created subject ${name} (${code})`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: { id: docRef.id, ...subjectData } });
  } catch (error) {
    console.error('createSubject error:', error);
    res.status(500).json({ success: false, error: 'Failed to create subject' });
  }
};

export const updateSubject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const subjectDoc = await db.collection('subjects').doc(id).get();
    if (!subjectDoc.exists) {
      res.status(404).json({ success: false, error: 'Subject not found' });
      return;
    }

    await db.collection('subjects').doc(id).update(updates);

    res.json({ success: true, data: { id, ...updates } });
  } catch (error) {
    console.error('updateSubject error:', error);
    res.status(500).json({ success: false, error: 'Failed to update subject' });
  }
};

export const deleteSubject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await db.collection('subjects').doc(id).delete();

    await db.collection('attendance_logs').add({
      action: 'DELETE_SUBJECT',
      userId: req.user!.uid,
      details: `Deleted subject ${id}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('deleteSubject error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete subject' });
  }
};

// ---- Class Management ----

export const getClasses = async (req: Request, res: Response): Promise<void> => {
  try {
    const department = req.query.department as string | undefined;
    const semester = req.query.semester as string | undefined;

    let query: FirebaseFirestore.Query = db.collection('classes');
    if (department) query = query.where('department', '==', department);
    if (semester) query = query.where('semester', '==', parseInt(semester));

    const snapshot = await query.get();
    const classes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, data: classes });
  } catch (error) {
    console.error('getClasses error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch classes' });
  }
};

export const createClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, department, semester, section, academicYear } = req.body;

    const classData = {
      name,
      department,
      semester,
      section,
      academicYear: academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      studentIds: [],
    };

    const docRef = await db.collection('classes').add(classData);

    await db.collection('attendance_logs').add({
      action: 'CREATE_CLASS',
      userId: req.user!.uid,
      details: `Created class ${name} (${department}, Sem ${semester}, Section ${section})`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: { id: docRef.id, ...classData } });
  } catch (error) {
    console.error('createClass error:', error);
    res.status(500).json({ success: false, error: 'Failed to create class' });
  }
};

export const updateClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const classDoc = await db.collection('classes').doc(id).get();
    if (!classDoc.exists) {
      res.status(404).json({ success: false, error: 'Class not found' });
      return;
    }

    // Don't allow overwriting studentIds through general update
    delete updates.studentIds;

    await db.collection('classes').doc(id).update(updates);

    res.json({ success: true, data: { id, ...updates } });
  } catch (error) {
    console.error('updateClass error:', error);
    res.status(500).json({ success: false, error: 'Failed to update class' });
  }
};

export const deleteClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await db.collection('classes').doc(id).delete();

    // Also delete related timetables
    const timetableSnapshot = await db.collection('timetables').where('classId', '==', id).get();
    const batch = db.batch();
    timetableSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    await db.collection('attendance_logs').add({
      action: 'DELETE_CLASS',
      userId: req.user!.uid,
      details: `Deleted class ${id} and related timetables`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Class deleted successfully' });
  } catch (error) {
    console.error('deleteClass error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete class' });
  }
};

// ---- Student-Class Assignment ----

export const assignStudentsToClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { studentIds } = req.body;

    const classDoc = await db.collection('classes').doc(id).get();
    if (!classDoc.exists) {
      res.status(404).json({ success: false, error: 'Class not found' });
      return;
    }

    const currentData = classDoc.data();
    const currentStudentIds: string[] = currentData?.studentIds || [];
    const newStudentIds = [...new Set([...currentStudentIds, ...studentIds])];

    await db.collection('classes').doc(id).update({ studentIds: newStudentIds });

    await db.collection('attendance_logs').add({
      action: 'ASSIGN_STUDENTS',
      userId: req.user!.uid,
      details: `Assigned ${studentIds.length} student(s) to class ${id}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: { classId: id, studentIds: newStudentIds } });
  } catch (error) {
    console.error('assignStudentsToClass error:', error);
    res.status(500).json({ success: false, error: 'Failed to assign students' });
  }
};

export const removeStudentsFromClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { studentIds } = req.body;

    const classDoc = await db.collection('classes').doc(id).get();
    if (!classDoc.exists) {
      res.status(404).json({ success: false, error: 'Class not found' });
      return;
    }

    const currentData = classDoc.data();
    const currentStudentIds: string[] = currentData?.studentIds || [];
    const updatedStudentIds = currentStudentIds.filter((sid) => !studentIds.includes(sid));

    await db.collection('classes').doc(id).update({ studentIds: updatedStudentIds });

    await db.collection('attendance_logs').add({
      action: 'REMOVE_STUDENTS',
      userId: req.user!.uid,
      details: `Removed ${studentIds.length} student(s) from class ${id}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: { classId: id, studentIds: updatedStudentIds } });
  } catch (error) {
    console.error('removeStudentsFromClass error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove students' });
  }
};

export const getClassDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const classDoc = await db.collection('classes').doc(id).get();
    if (!classDoc.exists) {
      res.status(404).json({ success: false, error: 'Class not found' });
      return;
    }

    const classData = classDoc.data();
    const studentIds: string[] = classData?.studentIds || [];

    // Fetch student details
    const students = [];
    for (const sid of studentIds) {
      const userDoc = await db.collection('users').doc(sid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        students.push({
          uid: userDoc.id,
          displayName: data?.displayName || 'Unknown',
          email: data?.email || '',
          rollNumber: data?.rollNumber || '',
          studentId: data?.studentId || '',
          department: data?.department || '',
        });
      }
    }

    // Fetch timetable entries for this class
    const timetableSnapshot = await db.collection('timetables').where('classId', '==', id).get();
    const timetables = timetableSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({
      success: true,
      data: {
        id: classDoc.id,
        ...classData,
        students,
        timetables,
      },
    });
  } catch (error) {
    console.error('getClassDetails error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch class details' });
  }
};

// ---- Timetable Management ----

export const getTimetables = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = req.query.classId as string | undefined;
    const teacherId = req.query.teacherId as string | undefined;

    let query: FirebaseFirestore.Query = db.collection('timetables');
    if (classId) query = query.where('classId', '==', classId);
    if (teacherId) query = query.where('teacherId', '==', teacherId);

    const snapshot = await query.get();
    const timetables = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Enrich with teacher and class names
    const enriched = [];
    for (const tt of timetables) {
      const ttData = tt as Record<string, unknown>;
      let teacherName = '';
      let className = '';

      if (ttData.teacherId) {
        const teacherDoc = await db.collection('users').doc(ttData.teacherId as string).get();
        teacherName = teacherDoc.exists ? teacherDoc.data()?.displayName || '' : '';
      }
      if (ttData.classId) {
        const classDoc = await db.collection('classes').doc(ttData.classId as string).get();
        className = classDoc.exists ? classDoc.data()?.name || '' : '';
      }

      enriched.push({ ...tt, teacherName, className });
    }

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('getTimetables error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch timetables' });
  }
};

export const createTimetable = async (req: Request, res: Response): Promise<void> => {
  try {
    const { teacherId, classId, subject, dayOfWeek, startTime, endTime, room } = req.body;

    // Validate teacher exists and is a teacher
    const teacherDoc = await db.collection('users').doc(teacherId).get();
    if (!teacherDoc.exists || teacherDoc.data()?.role !== 'teacher') {
      res.status(400).json({ success: false, error: 'Invalid teacher ID' });
      return;
    }

    // Validate class exists
    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) {
      res.status(400).json({ success: false, error: 'Invalid class ID' });
      return;
    }

    // Check for time conflicts for the teacher
    const teacherSchedule = await db
      .collection('timetables')
      .where('teacherId', '==', teacherId)
      .where('dayOfWeek', '==', dayOfWeek)
      .get();

    const hasConflict = teacherSchedule.docs.some((doc) => {
      const data = doc.data();
      return startTime < data.endTime && endTime > data.startTime;
    });

    if (hasConflict) {
      res.status(400).json({ success: false, error: 'Teacher has a time conflict on this day' });
      return;
    }

    // Check for time conflicts for the class
    const classSchedule = await db
      .collection('timetables')
      .where('classId', '==', classId)
      .where('dayOfWeek', '==', dayOfWeek)
      .get();

    const hasClassConflict = classSchedule.docs.some((doc) => {
      const data = doc.data();
      return startTime < data.endTime && endTime > data.startTime;
    });

    if (hasClassConflict) {
      res.status(400).json({ success: false, error: 'Class has a time conflict on this day' });
      return;
    }

    const timetableData: Omit<Timetable, 'id'> = {
      teacherId,
      classId,
      subject,
      dayOfWeek,
      startTime,
      endTime,
      room,
    };

    const docRef = await db.collection('timetables').add(timetableData);

    await db.collection('attendance_logs').add({
      action: 'CREATE_TIMETABLE',
      userId: req.user!.uid,
      details: `Created timetable: ${subject} for class ${classDoc.data()?.name}, teacher ${teacherDoc.data()?.displayName}, day ${dayOfWeek}`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: { id: docRef.id, ...timetableData } });
  } catch (error) {
    console.error('createTimetable error:', error);
    res.status(500).json({ success: false, error: 'Failed to create timetable entry' });
  }
};

export const updateTimetable = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const ttDoc = await db.collection('timetables').doc(id).get();
    if (!ttDoc.exists) {
      res.status(404).json({ success: false, error: 'Timetable entry not found' });
      return;
    }

    await db.collection('timetables').doc(id).update(updates);

    res.json({ success: true, data: { id, ...updates } });
  } catch (error) {
    console.error('updateTimetable error:', error);
    res.status(500).json({ success: false, error: 'Failed to update timetable entry' });
  }
};

export const deleteTimetable = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await db.collection('timetables').doc(id).delete();

    await db.collection('attendance_logs').add({
      action: 'DELETE_TIMETABLE',
      userId: req.user!.uid,
      details: `Deleted timetable entry ${id}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Timetable entry deleted successfully' });
  } catch (error) {
    console.error('deleteTimetable error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete timetable entry' });
  }
};

// ---- Logs ----

export const getLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    // Avoid .count() — get all and paginate in memory
    const allSnapshot = await db
      .collection('attendance_logs')
      .orderBy('timestamp', 'desc')
      .get();

    const total = allSnapshot.size;
    const startIdx = (page - 1) * limit;
    const paginatedDocs = allSnapshot.docs.slice(startIdx, startIdx + limit);

    const logs = paginatedDocs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({
      success: true,
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('getLogs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
};
