import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import LoginScreen from '../screens/auth/LoginScreen';
import TeacherHomeScreen from '../screens/teacher/TeacherHomeScreen';
import TakeAttendanceScreen from '../screens/teacher/TakeAttendanceScreen';
import TeacherAttendanceHistoryScreen from '../screens/teacher/AttendanceHistoryScreen';
import StudentHomeScreen from '../screens/student/StudentHomeScreen';
import AttendanceHistoryScreen from '../screens/student/AttendanceHistoryScreen';

const Stack = createNativeStackNavigator();

const headerStyle = {
  headerStyle: { backgroundColor: '#B40808' },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: '600' as const },
};

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#B40808" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={headerStyle}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : user.role === 'teacher' ? (
        <>
          <Stack.Screen name="TeacherHome" component={TeacherHomeScreen} options={{ title: 'Dashboard' }} />
          <Stack.Screen name="TakeAttendance" component={TakeAttendanceScreen} options={{ title: 'Take Attendance' }} />
          <Stack.Screen name="TeacherAttendanceHistory" component={TeacherAttendanceHistoryScreen} options={{ title: 'Attendance History' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="StudentHome" component={StudentHomeScreen} options={{ title: 'Dashboard' }} />
          <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} options={{ title: 'History' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
