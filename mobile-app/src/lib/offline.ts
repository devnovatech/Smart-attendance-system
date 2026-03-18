import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const SYNC_QUEUE_KEY = 'offline_sync_queue';

export interface OfflineAction {
  action: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export async function addToSyncQueue(item: OfflineAction): Promise<void> {
  const queue = await getSyncQueue();
  queue.push(item);
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export async function getSyncQueue(): Promise<OfflineAction[]> {
  const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  return data ? JSON.parse(data) : [];
}

export async function clearSyncQueue(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}

export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  const queue = await getSyncQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  try {
    const response = await api.post<{ success: boolean; data: { status: string }[] }>(
      '/sync/queue',
      { items: queue }
    );

    if (response.success) {
      const synced = response.data.filter((r) => r.status === 'synced').length;
      const failed = response.data.filter((r) => r.status === 'failed').length;
      await clearSyncQueue();
      return { synced, failed };
    }
  } catch {
    // Queue stays for next attempt
  }

  return { synced: 0, failed: queue.length };
}
