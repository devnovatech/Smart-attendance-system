import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
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

interface HistoryItem {
  id: string;
  date: string;
  subject: string;
  status: string;
}

export default function AttendanceHistoryScreen() {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    if (!user) return;
    try {
      const res = await api.get<ApiResponse<HistoryItem[]>>(`/student/${user.uid}/attendance`);
      if (res.data) setHistory(res.data);
    } catch {
      Alert.alert('Error', 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    present: { color: COLORS.green, bg: '#F0FDF4', label: 'Present' },
    absent: { color: COLORS.red, bg: '#FEF2F2', label: 'Absent' },
    late: { color: COLORS.yellow, bg: '#FFFBEB', label: 'Late' },
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.absent;
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardDate}>{item.date}</Text>
          <Text style={styles.cardSubject}>{item.subject}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: config.bg }]}>
          <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
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
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: { flex: 1 },
  cardDate: { fontSize: 12, color: COLORS.gray },
  cardSubject: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: COLORS.gray, marginTop: 40 },
});
