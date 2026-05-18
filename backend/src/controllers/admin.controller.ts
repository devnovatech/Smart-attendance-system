import { Request, Response } from 'express';
import { auth, db } from '../config/firebase';
import { User, AttendanceEntry, Course, Timetable, BulkUserRow } from '../types';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

const DEFAULT_DEPARTMENTS = ['Computer Science', 'Electronics', 'Mechanical'];

// ---- User Management ----

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const role = req.query.role as string;
    const search = ((req.query.search as string) || '').trim().toLowerCase();

    let query: FirebaseFirestore.Query = db.collection('users');
    if (role) query = query.where('role', '==', role);

    // Get all docs first (avoid .count() which may not be supported)
    const allSnapshot = await query.get();

    let allDocs = allSnapshot.docs;
    if (search) {
      allDocs = allDocs.filter((doc) => {
        const d = doc.data();
        const haystack = [
          d.displayName,
          d.email,
          d.rollNumber,
          d.studentId,
          d.department,
          d.guardianPhone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    const total = allDocs.length;
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
    const { email, password, displayName, role, rollNumber, studentId, department, guardianPhone } = req.body;

    const userRecord = await auth.createUser({ email, password, displayName });
    await auth.setCustomUserClaims(userRecord.uid, { role });

    const userData: Omit<User, 'uid'> = {
      email,
      displayName,
      role,
      rollNumber,
      studentId,
      department,
      ...(guardianPhone ? { guardianPhone } : {}),
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

export const bulkCreateUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { users } = req.body as { users: BulkUserRow[] };

    const results = {
      created: [] as { email: string; uid: string }[],
      failed: [] as { email: string; error: string }[],
    };

    for (const row of users) {
      try {
        const { email, password, displayName, role, rollNumber, studentId, department, guardianPhone } = row;
        const userRecord = await auth.createUser({ email, password, displayName });
        await auth.setCustomUserClaims(userRecord.uid, { role });

        const userData: Omit<User, 'uid'> = {
          email,
          displayName,
          role,
          ...(rollNumber ? { rollNumber } : {}),
          ...(studentId ? { studentId } : {}),
          ...(department ? { department } : {}),
          ...(guardianPhone ? { guardianPhone } : {}),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await db.collection('users').doc(userRecord.uid).set(userData);
        results.created.push({ email, uid: userRecord.uid });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create user';
        results.failed.push({ email: row.email, error: message });
      }
    }

    await db.collection('attendance_logs').add({
      action: 'BULK_CREATE_USERS',
      userId: req.user!.uid,
      details: `Bulk imported users — created ${results.created.length}, failed ${results.failed.length}`,
      timestamp: new Date().toISOString(),
    });

    res.status(207).json({ success: true, data: results });
  } catch (error) {
    console.error('bulkCreateUsers error:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk import users' });
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
          Course: (data as Record<string, unknown>).subject,
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
        departments: DEFAULT_DEPARTMENTS,
      };
      await db.collection('config').doc('global').set(defaultConfig);
      res.json({ success: true, data: defaultConfig });
      return;
    }

    const data = configDoc.data() || {};
    // Backfill departments for legacy configs created before this field existed
    if (!data.departments) {
      data.departments = DEFAULT_DEPARTMENTS;
      await db.collection('config').doc('global').set({ departments: DEFAULT_DEPARTMENTS }, { merge: true });
    }

    res.json({ success: true, data });
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

export const getDepartments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const configDoc = await db.collection('config').doc('global').get();
    const departments: string[] = configDoc.exists
      ? (configDoc.data()?.departments as string[]) || DEFAULT_DEPARTMENTS
      : DEFAULT_DEPARTMENTS;
    res.json({ success: true, data: departments });
  } catch (error) {
    console.error('getDepartments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch departments' });
  }
};

export const updateDepartments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { departments } = req.body as { departments: string[] };
    await db.collection('config').doc('global').set({ departments }, { merge: true });

    await db.collection('attendance_logs').add({
      action: 'UPDATE_DEPARTMENTS',
      userId: req.user!.uid,
      details: `Updated department list (${departments.length} entries)`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: departments });
  } catch (error) {
    console.error('updateDepartments error:', error);
    res.status(500).json({ success: false, error: 'Failed to update departments' });
  }
};

// ---- Course Management ----

export const getCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const department = req.query.department as string | undefined;
    const semester = req.query.semester as string | undefined;

    let query: FirebaseFirestore.Query = db.collection('courses');
    if (department) query = query.where('department', '==', department);
    if (semester) query = query.where('semester', '==', parseInt(semester));

    const snapshot = await query.get();
    const courses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, data: courses });
  } catch (error) {
    console.error('getCourses error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch courses' });
  }
};

export const createCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, code, department, semester, credits } = req.body;

    // Check for duplicate code
    const existing = await db.collection('courses').where('code', '==', code).get();
    if (!existing.empty) {
      res.status(400).json({ success: false, error: 'Course code already exists' });
      return;
    }

    const courseData: Omit<Course, 'id'> = {
      name,
      code,
      department,
      semester,
      credits,
    };

    const docRef = await db.collection('courses').add(courseData);

    await db.collection('attendance_logs').add({
      action: 'CREATE_COURSE',
      userId: req.user!.uid,
      details: `Created course ${name} (${code})`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: { id: docRef.id, ...courseData } });
  } catch (error) {
    console.error('createCourse error:', error);
    res.status(500).json({ success: false, error: 'Failed to create course' });
  }
};

export const updateCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const courseDoc = await db.collection('courses').doc(id).get();
    if (!courseDoc.exists) {
      res.status(404).json({ success: false, error: 'Course not found' });
      return;
    }

    await db.collection('courses').doc(id).update(updates);

    res.json({ success: true, data: { id, ...updates } });
  } catch (error) {
    console.error('updateCourse error:', error);
    res.status(500).json({ success: false, error: 'Failed to update course' });
  }
};

export const deleteCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await db.collection('courses').doc(id).delete();

    await db.collection('attendance_logs').add({
      action: 'DELETE_COURSE',
      userId: req.user!.uid,
      details: `Deleted course ${id}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    console.error('deleteCourse error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete course' });
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
    const classes = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Backfill courseIds for legacy class docs
        courseIds: data.courseIds || [],
      };
    });

    res.json({ success: true, data: classes });
  } catch (error) {
    console.error('getClasses error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch classes' });
  }
};

export const createClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, department, semester, section, academicYear, courseIds } = req.body;

    const classData = {
      name,
      department,
      semester,
      section,
      academicYear: academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      studentIds: [],
      courseIds: Array.isArray(courseIds) ? courseIds : [],
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

    // Don't allow overwriting studentIds / courseIds through general update;
    // use the dedicated endpoints instead.
    delete updates.studentIds;
    delete updates.courseIds;

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

// ---- Class-Course Assignment ----

export const assignCoursesToClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { courseIds } = req.body as { courseIds: string[] };

    const classDoc = await db.collection('classes').doc(id).get();
    if (!classDoc.exists) {
      res.status(404).json({ success: false, error: 'Class not found' });
      return;
    }

    const currentData = classDoc.data();
    const currentCourseIds: string[] = currentData?.courseIds || [];
    const newCourseIds = [...new Set([...currentCourseIds, ...courseIds])];

    await db.collection('classes').doc(id).update({ courseIds: newCourseIds });

    await db.collection('attendance_logs').add({
      action: 'ASSIGN_COURSES',
      userId: req.user!.uid,
      details: `Assigned ${courseIds.length} course(s) to class ${id}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: { classId: id, courseIds: newCourseIds } });
  } catch (error) {
    console.error('assignCoursesToClass error:', error);
    res.status(500).json({ success: false, error: 'Failed to assign courses' });
  }
};

export const removeCoursesFromClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { courseIds } = req.body as { courseIds: string[] };

    const classDoc = await db.collection('classes').doc(id).get();
    if (!classDoc.exists) {
      res.status(404).json({ success: false, error: 'Class not found' });
      return;
    }

    const currentData = classDoc.data();
    const currentCourseIds: string[] = currentData?.courseIds || [];
    const updatedCourseIds = currentCourseIds.filter((cid) => !courseIds.includes(cid));

    await db.collection('classes').doc(id).update({ courseIds: updatedCourseIds });

    await db.collection('attendance_logs').add({
      action: 'REMOVE_COURSES',
      userId: req.user!.uid,
      details: `Removed ${courseIds.length} course(s) from class ${id}`,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, data: { classId: id, courseIds: updatedCourseIds } });
  } catch (error) {
    console.error('removeCoursesFromClass error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove courses' });
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

    const classData = classDoc.data() || {};
    const studentIds: string[] = classData.studentIds || [];
    const courseIds: string[] = classData.courseIds || [];

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
          guardianPhone: data?.guardianPhone || '',
        });
      }
    }

    // Fetch course details
    const courses = [];
    for (const cid of courseIds) {
      const courseDoc = await db.collection('courses').doc(cid).get();
      if (courseDoc.exists) {
        courses.push({ id: courseDoc.id, ...courseDoc.data() });
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
        courseIds,
        students,
        courses,
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
    const { teacherId, classId, courseId, dayOfWeek, startTime, endTime, room } = req.body;

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

    // Validate course exists and fetch its name to snapshot
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      res.status(400).json({ success: false, error: 'Invalid course ID' });
      return;
    }
    const courseName: string = courseDoc.data()?.name || '';

    // Check for room conflicts on the same day and overlapping time
    const roomSchedule = await db
      .collection('timetables')
      .where('dayOfWeek', '==', dayOfWeek)
      .get();

    const hasRoomConflict = roomSchedule.docs.some((doc) => {
      const data = doc.data();
      if (data.room?.trim().toLowerCase() !== room.trim().toLowerCase()) return false;
      return startTime < data.endTime && endTime > data.startTime;
    });

    if (hasRoomConflict) {
      res.status(400).json({ success: false, error: 'Room is already booked for this time slot' });
      return;
    }

    // Check for time conflicts for the teacher
    const teacherSchedule = roomSchedule.docs.filter((doc) => doc.data().teacherId === teacherId);

    const hasConflict = teacherSchedule.some((doc) => {
      const data = doc.data();
      return startTime < data.endTime && endTime > data.startTime;
    });

    if (hasConflict) {
      res.status(400).json({ success: false, error: 'Teacher has a time conflict on this day' });
      return;
    }

    // Check for time conflicts for the class
    const classSchedule = roomSchedule.docs.filter((doc) => doc.data().classId === classId);

    const hasClassConflict = classSchedule.some((doc) => {
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
      courseId,
      subject: courseName,
      dayOfWeek,
      startTime,
      endTime,
      room,
    };

    const docRef = await db.collection('timetables').add(timetableData);

    await db.collection('attendance_logs').add({
      action: 'CREATE_TIMETABLE',
      userId: req.user!.uid,
      details: `Created timetable: ${courseName} for class ${classDoc.data()?.name}, teacher ${teacherDoc.data()?.displayName}, day ${dayOfWeek}`,
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
    const updates = { ...req.body };

    const ttDoc = await db.collection('timetables').doc(id).get();
    if (!ttDoc.exists) {
      res.status(404).json({ success: false, error: 'Timetable entry not found' });
      return;
    }

    // If courseId is being changed, refresh the snapshot of subject (course name)
    if (updates.courseId) {
      const courseDoc = await db.collection('courses').doc(updates.courseId).get();
      if (!courseDoc.exists) {
        res.status(400).json({ success: false, error: 'Invalid course ID' });
        return;
      }
      updates.subject = courseDoc.data()?.name || '';
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
