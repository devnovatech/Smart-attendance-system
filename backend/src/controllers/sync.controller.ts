import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { SyncQueueItem } from '../types';

export const processSyncQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.uid;
    const { items } = req.body;

    const results: { id: string; status: string; error?: string }[] = [];

    for (const item of items) {
      try {
        const syncItem: Omit<SyncQueueItem, 'id'> = {
          userId,
          action: item.action,
          data: item.data,
          createdAt: item.createdAt,
          syncedAt: new Date().toISOString(),
          status: 'synced',
          retries: 0,
        };

        // Process based on action type
        switch (item.action) {
          case 'MARK_ATTENDANCE': {
            const { classId, studentId, status, date, subject } = item.data as Record<string, string>;
            const snapshot = await db
              .collection('attendance_records')
              .where('classId', '==', classId)
              .where('date', '==', date)
              .where('subject', '==', subject)
              .limit(1)
              .get();

            if (!snapshot.empty) {
              const docRef = snapshot.docs[0].ref;
              const currentData = snapshot.docs[0].data();
              const records = currentData.records || [];
              const existingIdx = records.findIndex(
                (r: Record<string, string>) => r.studentId === studentId
              );

              if (existingIdx >= 0) {
                records[existingIdx] = {
                  studentId,
                  status,
                  markedAt: item.createdAt,
                  markedBy: userId,
                };
              } else {
                records.push({
                  studentId,
                  status,
                  markedAt: item.createdAt,
                  markedBy: userId,
                });
              }

              await docRef.update({ records });
            }
            break;
          }
          default:
            syncItem.status = 'failed';
        }

        const docRef = await db.collection('sync_queue').add(syncItem);
        results.push({ id: docRef.id, status: syncItem.status });
      } catch (error) {
        const errorRef = await db.collection('sync_queue').add({
          userId,
          action: item.action,
          data: item.data,
          createdAt: item.createdAt,
          status: 'failed',
          retries: 0,
        });
        results.push({
          id: errorRef.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to process sync queue' });
  }
};

export const getSyncStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.uid;

    const pendingSnapshot = await db
      .collection('sync_queue')
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .get();

    const failedSnapshot = await db
      .collection('sync_queue')
      .where('userId', '==', userId)
      .where('status', '==', 'failed')
      .get();

    res.json({
      success: true,
      data: {
        pending: pendingSnapshot.size,
        failed: failedSnapshot.size,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch sync status' });
  }
};
