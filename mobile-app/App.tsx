import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { NavigationContainerRef } from '@react-navigation/native';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { registerForPushNotifications, addNotificationResponseListener } from './src/lib/notifications';
import { processSyncQueue } from './src/lib/offline';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<Record<string, object | undefined>>>(null);
  const [isNavReady, setIsNavReady] = useState(false);
  // Store pending navigation from notification tap when nav isn't ready yet
  const pendingNavRef = useRef<{ classId: string; subject: string } | null>(null);

  const navigateToAttendance = useCallback((classId: string, subject: string) => {
    const nav = navigationRef.current;
    if (nav?.isReady()) {
      nav.navigate('TakeAttendance' as never, { classId, subject } as never);
    } else {
      // Store for later when nav becomes ready
      pendingNavRef.current = { classId, subject };
    }
  }, []);

  // Process pending navigation when navigator becomes ready
  const handleNavReady = useCallback(() => {
    setIsNavReady(true);
    if (pendingNavRef.current) {
      const { classId, subject } = pendingNavRef.current;
      pendingNavRef.current = null;
      // Small delay to ensure screens are mounted
      setTimeout(() => {
        navigationRef.current?.navigate('TakeAttendance' as never, { classId, subject } as never);
      }, 500);
    }
  }, []);

  useEffect(() => {
    registerForPushNotifications();

    // Check if app was opened from a notification (cold start)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        if (data?.type === 'CLASS_REMINDER' && data.classId && data.subject) {
          navigateToAttendance(data.classId as string, data.subject as string);
        }
      }
    });

    // Auto-sync when connection is restored
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        processSyncQueue().then(({ synced, failed }) => {
          if (synced > 0) {
            console.log(`Synced ${synced} items, ${failed} failed`);
          }
        });
      }
    });

    // Handle notification taps — navigate to the class attendance screen
    const removeListener = addNotificationResponseListener((classId, subject) => {
      navigateToAttendance(classId, subject);
    });

    return () => {
      unsubscribe();
      removeListener();
    };
  }, [navigateToAttendance]);

  return (
    <NavigationContainer ref={navigationRef} onReady={handleNavReady}>
      <AuthProvider>
        <StatusBar style="light" backgroundColor="#B40808" />
        <AppNavigator />
      </AuthProvider>
    </NavigationContainer>
  );
}
