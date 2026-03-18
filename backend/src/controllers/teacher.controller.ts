import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { AttendanceRecord, AttendanceEntry } from '../types';

export const getTimetable = async (req: Request, res: Response): Promise<void> => {
  try {
    const teacherId = req.user!.uid;
    const snapshot = await db
      .collection('timetables')
      .where('teacherId', '==', teacherId)
      .get();

    const timetables = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, data: timetables });
  } catch (error) {
    console.error('getTimetable error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch timetable' });
  }
};

export const getCurrentClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const teacherId = req.user!.uid;
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const snapshot = await db
      .collection('timetables')
      .where('teacherId', '==', teacherId)
      .where('dayOfWeek', '==', currentDay)
      .get();

    const entries = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as {
        classId: string;
        startTime: string;
        endTime: string;
        subject: string;
        room: string;
      }),
    }));

    const currentClass = entries.find(
      (t) => currentTime >= t.startTime && currentTime <= t.endTime
    );

    if (!currentClass) {
      res.json({ success: true, data: null, message: 'No class currently in session' });
      return;
    }

    const classDoc = await db.collection('classes').doc(currentClass.classId).get();

    res.json({
      success: true,
      data: {
        timetable: currentClass,
        class: classDoc.exists ? { id: classDoc.id, ...classDoc.data() } : null,
      },
    });
  } catch (error) {
    console.error('getCurrentClass error:', error);
    res.status(500).json({ success: false, error: 'Failed to detect current class' });
  }
};

export const startAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const teacherId = req.user!.uid;
    const { classId, subject } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // Check for existing session — simple query without compound index
    const existing = await db
      .collection('attendance_records')
      .where('classId', '==', classId)
      .where('date', '==', today)
      .get();

    const existingDoc = existing.docs.find(
      (doc) => doc.data().teacherId === teacherId && doc.data().subject === subject
    );

    if (existingDoc) {
      res.json({
        success: true,
        data: { id: existingDoc.id, ...existingDoc.data() },
        message: 'Attendance session already exists for today',
      });
      return;
    }

    const record: Omit<AttendanceRecord, 'id'> = {
      classId,
      teacherId,
      subject,
      date: today,
      startedAt: new Date().toISOString(),
      status: 'in_progress',
      records: [],
    };

    const docRef = await db.collection('attendance_records').add(record);

    await db.collection('attendance_logs').add({
      action: 'START_ATTENDANCE',
      userId: teacherId,
      details: `Started attendance for class ${classId}, subject ${subject}`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      data: { id: docRef.id, ...record },
    });
  } catch (error) {
    console.error('startAttendance error:', error);
    res.status(500).json({ success: false, error: 'Failed to start attendance' });
  }
};

export const markAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;
    const { studentId, status } = req.body;
    const teacherId = req.user!.uid;
    const today = new Date().toISOString().split('T')[0];

    // Simple query — filter in memory to avoid compound index
    const snapshot = await db
      .collection('attendance_records')
      .where('classId', '==', classId)
      .where('date', '==', today)
      .get();

    const activeDoc = snapshot.docs.find(
      (doc) => doc.data().teacherId === teacherId && doc.data().status === 'in_progress'
    );

    if (!activeDoc) {
      res.status(404).json({ success: false, error: 'No active attendance session found' });
      return;
    }

    const entry: AttendanceEntry = {
      studentId,
      status,
      markedAt: new Date().toISOString(),
      markedBy: teacherId,
    };

    const currentData = activeDoc.data();
    const updatedRecords = [
      ...(currentData.records || []).filter((r: AttendanceEntry) => r.studentId !== studentId),
      entry,
    ];

    await activeDoc.ref.update({ records: updatedRecords });

    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('markAttendance error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark attendance' });
  }
};

export const submitAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;
    const teacherId = req.user!.uid;
    const today = new Date().toISOString().split('T')[0];

    const snapshot = await db
      .collection('attendance_records')
      .where('classId', '==', classId)
      .where('date', '==', today)
      .get();

    const activeDoc = snapshot.docs.find(
      (doc) => doc.data().teacherId === teacherId && doc.data().status === 'in_progress'
    );

    if (!activeDoc) {
      res.status(404).json({ success: false, error: 'No active attendance session found' });
      return;
    }

    const data = activeDoc.data();

    // Check for students not yet marked
    const classDoc = await db.collection('classes').doc(classId).get();
    const classData = classDoc.data();
    const allStudents: string[] = classData?.studentIds || [];
    const markedStudents = (data.records || []).map((r: AttendanceEntry) => r.studentId);
    const skippedStudents = allStudents.filter((s) => !markedStudents.includes(s));

    if (skippedStudents.length > 0 && !req.body.confirmSkipped) {
      res.json({
        success: false,
        data: { skippedStudents },
        message: 'Some students have not been marked. Send confirmSkipped: true to proceed.',
      });
      return;
    }

    // Mark skipped students as absent
    const finalRecords = [...(data.records || [])];
    for (const sid of skippedStudents) {
      finalRecords.push({
        studentId: sid,
        status: 'absent',
        markedAt: new Date().toISOString(),
        markedBy: teacherId,
      });
    }

    await activeDoc.ref.update({
      records: finalRecords,
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    await db.collection('attendance_logs').add({
      action: 'SUBMIT_ATTENDANCE',
      userId: teacherId,
      details: `Submitted attendance for class ${classId}. Total: ${allStudents.length}, Present: ${finalRecords.filter((r: AttendanceEntry) => r.status === 'present').length}`,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      data: { id: activeDoc.id, records: finalRecords, status: 'completed' },
    });
  } catch (error) {
    console.error('submitAttendance error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit attendance' });
  }
};

export const getAttendanceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;
    const teacherId = req.user!.uid;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    // Simple query — filter and sort in memory
    const snapshot = await db
      .collection('attendance_records')
      .where('classId', '==', classId)
      .get();

    let records = snapshot.docs
      .filter((doc) => doc.data().teacherId === teacherId)
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => ((b as Record<string, string>).date || '').localeCompare((a as Record<string, string>).date || ''));

    if (startDate) records = records.filter((r) => (r as Record<string, string>).date >= startDate);
    if (endDate) records = records.filter((r) => (r as Record<string, string>).date <= endDate);

    const total = records.length;
    const paginatedRecords = records.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: paginatedRecords,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('getAttendanceHistory error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance history' });
  }
};

export const getClassStudents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) {
      res.status(404).json({ success: false, error: 'Class not found' });
      return;
    }

    const classData = classDoc.data();
    const studentIds: string[] = classData?.studentIds || [];
    const total = studentIds.length;

    const paginatedIds = studentIds.slice((page - 1) * limit, page * limit);

    const students = [];
    for (const id of paginatedIds) {
      const userDoc = await db.collection('users').doc(id).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        students.push({
          uid: userDoc.id,
          id: userDoc.id,
          displayName: data?.displayName || 'Unknown',
          email: data?.email || '',
          rollNumber: data?.rollNumber || '',
          studentId: data?.studentId || '',
          department: data?.department || '',
          photoURL: data?.photoURL || '',
          role: data?.role || 'student',
        });
      }
    }

    res.json({
      success: true,
      data: students,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('getClassStudents error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
};
