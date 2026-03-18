import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { Timetable, ApiResponse } from '../../types';
import { scheduleClassNotifications } from '../../lib/notifications';

const COLORS = {
  primary: '#B40808',
  white: '#FFFFFF',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  green: '#10B981',
};

export default function TeacherHomeScreen({ navigation }: { navigation: any }) {
  const { user, logout } = useAuth();
  const [timetable, setTimetable] = useState<Timetable[]>([]);
  const [currentClass, setCurrentClass] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ttRes, ccRes] = await Promise.all([
        api.get<ApiResponse<Timetable[]>>('/teacher/timetable'),
        api.get<ApiResponse>('/teacher/current-class'),
      ]);
      if (ttRes.data) {
        setTimetable(ttRes.data);
        // Schedule push notifications for upcoming classes
        scheduleClassNotifications(ttRes.data);
      }
      if (ccRes.data) setCurrentClass(ccRes.data);
    } catch {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAttendance = async (classId: string, subject: string) => {
    try {
      await api.post('/teacher/attendance/start', { classId, subject });
      navigation.navigate('TakeAttendance', { classId, subject });
    } catch {
      Alert.alert('Error', 'Failed to start attendance');
    }
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();
  const todayClasses = timetable
    .filter((t) => t.dayOfWeek === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome,</Text>
          <Text style={styles.name}>{user?.displayName}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {currentClass && (
        <View style={styles.currentClassCard}>
          <Text style={styles.currentLabel}>Current Class</Text>
          <Text style={styles.currentSubject}>{currentClass.timetable.subject}</Text>
          <Text style={styles.currentDetails}>
            {currentClass.timetable.startTime} - {currentClass.timetable.endTime} | Room{' '}
            {currentClass.timetable.room}
          </Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() =>
              handleStartAttendance(currentClass.timetable.classId, currentClass.timetable.subject)
            }
          >
            <Text style={styles.startBtnText}>Start Attendance</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Today&apos;s Schedule</Text>
      {todayClasses.length === 0 ? (
        <Text style={styles.emptyText}>No classes today</Text>
      ) : (
        todayClasses.map((entry) => (
          <View key={entry.id} style={styles.classCard}>
            <View style={styles.classInfo}>
              <Text style={styles.classTime}>
                {entry.startTime} - {entry.endTime}
              </Text>
              <Text style={styles.classSubject}>{entry.subject}</Text>
              <Text style={styles.classRoom}>Room {entry.room}</Text>
            </View>
            <View style={styles.classActions}>
              <TouchableOpacity
                style={styles.historyBtn}
                onPress={() => navigation.navigate('TeacherAttendanceHistory', { classId: entry.classId, subject: entry.subject })}
              >
                <Text style={styles.historyBtnText}>History</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.takeBtn}
                onPress={() => handleStartAttendance(entry.classId, entry.subject)}
              >
                <Text style={styles.takeBtnText}>Take</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightGray, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  greeting: { fontSize: 14, color: COLORS.gray },
  name: { fontSize: 22, fontWeight: 'bold' },
  logoutBtn: { padding: 8 },
  logoutText: { color: COLORS.primary, fontWeight: '600' },
  currentClassCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  currentLabel: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  currentSubject: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginTop: 4 },
  currentDetails: { fontSize: 13, color: '#991B1B', marginTop: 2 },
  startBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  startBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  emptyText: { color: COLORS.gray, textAlign: 'center', marginTop: 20 },
  classCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  classInfo: { flex: 1 },
  classTime: { fontSize: 12, color: COLORS.gray },
  classSubject: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  classRoom: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  takeBtn: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  takeBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  classActions: { flexDirection: 'row', gap: 8 },
  historyBtn: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historyBtnText: { color: COLORS.gray, fontWeight: '600', fontSize: 13 },
});
