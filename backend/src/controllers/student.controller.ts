import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { AttendanceEntry } from '../types';

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.user!.uid;

    const classesSnapshot = await db
      .collection('classes')
      .where('studentIds', 'array-contains', studentId)
      .get();

    const subjectStats: Record<
      string,
      { total: number; present: number; late: number; absent: number; percentage: number }
    > = {};

    for (const classDoc of classesSnapshot.docs) {
      // Simple query — avoid compound index requirement
      const attendanceSnapshot = await db
        .collection('attendance_records')
        .where('classId', '==', classDoc.id)
        .get();

      for (const attDoc of attendanceSnapshot.docs) {
        const data = attDoc.data();

        // Filter in memory instead of Firestore compound query
        if (data.status !== 'completed') continue;

        const subject = data.subject;
        const studentRecord = (data.records || []).find(
          (r: AttendanceEntry) => r.studentId === studentId
        );

        if (!subjectStats[subject]) {
          subjectStats[subject] = { total: 0, present: 0, late: 0, absent: 0, percentage: 0 };
        }

        subjectStats[subject].total += 1;

        if (studentRecord) {
          if (studentRecord.status === 'present') subjectStats[subject].present += 1;
          else if (studentRecord.status === 'late') subjectStats[subject].late += 1;
          else subjectStats[subject].absent += 1;
        } else {
          subjectStats[subject].absent += 1;
        }
      }
    }

    // Calculate percentages
    for (const subject of Object.keys(subjectStats)) {
      const stats = subjectStats[subject];
      stats.percentage =
        stats.total > 0
          ? Math.round(((stats.present + stats.late) / stats.total) * 100)
          : 0;
    }

    // Get threshold config
    const configDoc = await db.collection('config').doc('global').get();
    const threshold = configDoc.exists ? configDoc.data()?.attendanceThreshold || 75 : 75;

    res.json({
      success: true,
      data: {
        subjects: subjectStats,
        threshold,
        alerts: Object.entries(subjectStats)
          .filter(([_, stats]) => stats.percentage < threshold)
          .map(([subject, stats]) => ({
            subject,
            percentage: stats.percentage,
            message: `Your attendance in ${subject} is ${stats.percentage}% (below ${threshold}%)`,
          })),
      },
    });
  } catch (error) {
    console.error('getDashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard' });
  }
};

export const getAttendanceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id || req.user!.uid;
    const subject = req.query.subject as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const classesSnapshot = await db
      .collection('classes')
      .where('studentIds', 'array-contains', studentId)
      .get();

    const classIds = classesSnapshot.docs.map((doc) => doc.id);

    if (classIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const allRecords: Record<string, unknown>[] = [];

    // Query each class separately to avoid 'in' + compound index issues
    for (const classId of classIds) {
      const snapshot = await db
        .collection('attendance_records')
        .where('classId', '==', classId)
        .get();

      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Filter in memory
        if (data.status !== 'completed') continue;
        if (subject && data.subject !== subject) continue;
        if (startDate && data.date < startDate) continue;
        if (endDate && data.date > endDate) continue;

        const studentRecord = (data.records || []).find(
          (r: AttendanceEntry) => r.studentId === studentId
        );

        allRecords.push({
          id: doc.id,
          date: data.date,
          subject: data.subject,
          classId: data.classId,
          status: studentRecord?.status || 'absent',
          markedAt: studentRecord?.markedAt,
        });
      }
    }

    // Sort by date descending
    allRecords.sort((a, b) => ((b.date as string) || '').localeCompare((a.date as string) || ''));

    res.json({ success: true, data: allRecords });
  } catch (error) {
    console.error('getAttendanceHistory error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance history' });
  }
};

export const getCalendarView = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id || req.user!.uid;
    const { month, year } = req.query;

    const targetMonth = parseInt(month as string) || new Date().getMonth() + 1;
    const targetYear = parseInt(year as string) || new Date().getFullYear();

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-31`;

    const classesSnapshot = await db
      .collection('classes')
      .where('studentIds', 'array-contains', studentId)
      .get();

    const classIds = classesSnapshot.docs.map((doc) => doc.id);
    const calendarData: Record<string, { subjects: Record<string, string> }> = {};

    // Query each class separately — filter date in memory
    for (const classId of classIds) {
      const snapshot = await db
        .collection('attendance_records')
        .where('classId', '==', classId)
        .get();

      for (const doc of snapshot.docs) {
        const data = doc.data();

        if (data.status !== 'completed') continue;
        if (data.date < startDate || data.date > endDate) continue;

        const date = data.date;
        const studentRecord = (data.records || []).find(
          (r: AttendanceEntry) => r.studentId === studentId
        );

        if (!calendarData[date]) {
          calendarData[date] = { subjects: {} };
        }

        calendarData[date].subjects[data.subject] = studentRecord?.status || 'absent';
      }
    }

    res.json({ success: true, data: calendarData });
  } catch (error) {
    console.error('getCalendarView error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch calendar view' });
  }
};
