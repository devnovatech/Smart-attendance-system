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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import { DashboardData, ApiResponse } from '../../types';
import { sendLocalNotification } from '../../lib/notifications';

const COLORS = {
  primary: '#B40808',
  white: '#FFFFFF',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  green: '#10B981',
  red: '#EF4444',
  yellow: '#F59E0B',
};

export default function StudentHomeScreen({ navigation }: { navigation: any }) {
  const { user, logout } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.get<ApiResponse<DashboardData>>('/student/dashboard');
      if (res.data) {
        setData(res.data);
        // Send notifications for low attendance
        for (const alert of res.data.alerts) {
          await sendLocalNotification('Low Attendance Alert', alert.message);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
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

      {/* Alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <View style={styles.alertSection}>
          {data.alerts.map((alert, idx) => (
            <View key={idx} style={styles.alertCard}>
              <Ionicons name="warning" size={18} color={COLORS.red} />
              <Text style={styles.alertText}>{alert.message}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Subject Cards */}
      <Text style={styles.sectionTitle}>Subject-wise Attendance</Text>
      {data?.subjects && Object.entries(data.subjects).map(([subject, stats]) => {
        const isLow = stats.percentage < (data.threshold || 75);
        return (
          <View key={subject} style={[styles.subjectCard, isLow && styles.subjectCardLow]}>
            <View style={styles.subjectHeader}>
              <Text style={styles.subjectName}>{subject}</Text>
              <Text style={[styles.percentage, isLow ? { color: COLORS.red } : { color: COLORS.green }]}>
                {stats.percentage}%
              </Text>
            </View>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${stats.percentage}%` },
                  isLow ? { backgroundColor: COLORS.red } : { backgroundColor: COLORS.green },
                ]}
              />
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: COLORS.green }]}>{stats.present}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: COLORS.red }]}>{stats.absent}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: COLORS.yellow }]}>{stats.late}</Text>
                <Text style={styles.statLabel}>Late</Text>
              </View>
            </View>
          </View>
        );
      })}

      {/* View History */}
      <TouchableOpacity
        style={styles.historyBtn}
        onPress={() => navigation.navigate('AttendanceHistory')}
      >
        <Text style={styles.historyBtnText}>View Full History</Text>
        <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
      </TouchableOpacity>

      <View style={styles.thresholdInfo}>
        <Text style={styles.thresholdText}>
          Minimum threshold: {data?.threshold || 75}%
        </Text>
      </View>
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
  alertSection: { marginBottom: 16 },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  alertText: { fontSize: 13, color: '#991B1B', flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  subjectCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.green,
  },
  subjectCardLow: { borderLeftColor: COLORS.red },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectName: { fontSize: 15, fontWeight: '600' },
  percentage: { fontSize: 18, fontWeight: 'bold' },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginBottom: 10,
  },
  progressFill: { height: 6, borderRadius: 3 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 16, fontWeight: 'bold' },
  statLabel: { fontSize: 10, color: COLORS.gray, marginTop: 2 },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 10,
    gap: 4,
  },
  historyBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 15 },
  thresholdInfo: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
  },
  thresholdText: { fontSize: 13, color: COLORS.gray, textAlign: 'center' },
});
