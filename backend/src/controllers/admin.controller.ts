import { Request, Response } from 'express';
import { auth, db } from '../config/firebase';
import { User, AttendanceEntry } from '../types';
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
