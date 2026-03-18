import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Timetable } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('attendance', {
      name: 'Attendance Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync('class-reminders', {
      name: 'Class Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('Push notifications: no EAS projectId configured, skipping token registration');
    return null;
  }
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;
}

export async function sendLocalNotification(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

/**
 * Schedule weekly notifications for all timetable entries.
 * Each notification fires 5 minutes before the class starts.
 * The notification data includes classId and subject for deep-linking.
 */
export async function scheduleClassNotifications(timetable: Timetable[]): Promise<void> {
  // Cancel existing class reminder notifications
  await cancelClassNotifications();

  for (const entry of timetable) {
    // Parse start time (e.g., "09:00" or "14:30")
    const [hours, minutes] = entry.startTime.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) continue;

    // Schedule 5 minutes before class
    let notifyMinutes = minutes - 5;
    let notifyHours = hours;
    if (notifyMinutes < 0) {
      notifyMinutes += 60;
      notifyHours -= 1;
    }
    if (notifyHours < 0) notifyHours += 24;

    // Map dayOfWeek (JS: 0=Sun) to Expo weekly (1=Sun)
    const weekday = entry.dayOfWeek + 1;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Class Starting Soon',
          body: `${entry.subject} in Room ${entry.room} at ${entry.startTime}`,
          sound: true,
          data: {
            type: 'CLASS_REMINDER',
            classId: entry.classId,
            subject: entry.subject,
          },
          ...(Platform.OS === 'android' ? { channelId: 'class-reminders' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: notifyHours,
          minute: notifyMinutes,
        },
        identifier: `class-${entry.id}`,
      });
    } catch (error) {
      console.warn(`Failed to schedule notification for ${entry.subject}:`, error);
    }
  }
}

/**
 * Cancel all scheduled class reminder notifications.
 */
export async function cancelClassNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.identifier.startsWith('class-')) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

/**
 * Set up a listener for notification responses (taps).
 * Returns a cleanup function.
 */
export function addNotificationResponseListener(
  callback: (classId: string, subject: string) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.type === 'CLASS_REMINDER' && data.classId && data.subject) {
      callback(data.classId as string, data.subject as string);
    }
  });

  return () => subscription.remove();
}
