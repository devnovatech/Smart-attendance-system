import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { NavigationContainerRef } from '@react-navigation/native';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { registerForPushNotifications, addNotificationResponseListener } from './src/lib/notifications';
import { processSyncQueue } from './src/lib/offline';
import NetInfo from '@react-native-community/netinfo';

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<Record<string, object | undefined>>>(null);

  useEffect(() => {
    registerForPushNotifications();

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
      const nav = navigationRef.current;
      if (nav?.isReady()) {
        // Navigate to TakeAttendance screen with the class details
        nav.navigate('TakeAttendance' as never, { classId, subject } as never);
      }
    });

    return () => {
      unsubscribe();
      removeListener();
    };
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <AuthProvider>
        <StatusBar style="light" backgroundColor="#B40808" />
        <AppNavigator />
      </AuthProvider>
    </NavigationContainer>
  );
}
