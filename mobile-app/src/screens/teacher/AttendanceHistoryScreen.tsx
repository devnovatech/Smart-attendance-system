import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { ApiResponse } from '../../types';

const COLORS = {
  primary: '#B40808',
  white: '#FFFFFF',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  green: '#10B981',
  red: '#EF4444',
  yellow: '#F59E0B',
};

interface AttendanceEntry {
  studentId: string;
  status: 'present' | 'absent' | 'late';
  markedAt: string;
}

interface AttendanceRecord {
  id: string;
  classId: string;
  subject: string;
  date: string;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed';
  records: AttendanceEntry[];
}

export default function TeacherAttendanceHistoryScreen({ route }: { route: any }) {
  const { classId, subject } = route.params;
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await api.get<ApiResponse<AttendanceRecord[]>>(`/teacher/${classId}/attendance`);
      if (res.data) setRecords(res.data);
    } catch {
      Alert.alert('Error', 'Failed to load attendance history');
    } finally {
      setLoading(false);
    }
  };

  const renderRecord = ({ item }: { item: AttendanceRecord }) => {
    const presentCount = item.records.filter((r) => r.status === 'present').length;
    const absentCount = item.records.filter((r) => r.status === 'absent').length;
    const lateCount = item.records.filter((r) => r.status === 'late').length;
    const total = item.records.length;
    const percentage = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardDate}>{item.date}</Text>
            <Text style={styles.cardSubject}>{item.subject}</Text>
          </View>
          <View style={[styles.statusBadge, item.status === 'completed' ? styles.badgeCompleted : styles.badgeProgress]}>
            <Text style={[styles.badgeText, item.status === 'completed' ? styles.badgeTextCompleted : styles.badgeTextProgress]}>
              {item.status === 'completed' ? 'Completed' : 'In Progress'}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={14} color={COLORS.gray} />
            <Text style={styles.statText}>{total} Total</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.green} />
            <Text style={styles.statText}>{presentCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="close-circle" size={14} color={COLORS.red} />
            <Text style={styles.statText}>{absentCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time" size={14} color={COLORS.yellow} />
            <Text style={styles.statText}>{lateCount}</Text>
          </View>
          <View style={styles.percentageBox}>
            <Text style={[styles.percentageText, percentage < 75 ? { color: COLORS.red } : { color: COLORS.green }]}>
              {percentage}%
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{subject}</Text>
        <Text style={styles.subtitle}>Attendance History</Text>
      </View>
      <FlatList
        data={records}
        renderItem={renderRecord}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No attendance records found.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightGray },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: 'bold' },
  subtitle: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardDate: { fontSize: 12, color: COLORS.gray },
  cardSubject: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeCompleted: { backgroundColor: '#F0FDF4' },
  badgeProgress: { backgroundColor: '#FFFBEB' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeTextCompleted: { color: COLORS.green },
  badgeTextProgress: { color: COLORS.yellow },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: COLORS.gray },
  percentageBox: { marginLeft: 'auto' },
  percentageText: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: COLORS.gray, marginTop: 40 },
});
