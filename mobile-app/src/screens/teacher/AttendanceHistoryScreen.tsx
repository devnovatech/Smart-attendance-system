import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { ApiResponse, User, AttendanceStatus } from '../../types';

const COLORS = {
  primary: '#B40808',
  white: '#FFFFFF',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  green: '#10B981',
  red: '#EF4444',
  yellow: '#F59E0B',
  darkGreen: '#059669',
  darkRed: '#DC2626',
  darkYellow: '#D97706',
};

interface AttendanceEntry {
  studentId: string;
  studentName?: string;
  status: AttendanceStatus;
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
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedEntries, setEditedEntries] = useState<AttendanceEntry[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHistory();
    loadStudents();
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

  const loadStudents = async () => {
    try {
      const res = await api.get<ApiResponse<User[]>>(`/teacher/${classId}/students`);
      if (res.data) setStudents(res.data);
    } catch {
      // Students will show IDs instead of names
    }
  };

  const getStudentName = (studentId: string): string => {
    const student = students.find((s) => s.uid === studentId);
    return student?.displayName || studentId;
  };

  const openRecord = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setEditedEntries(record.records.map((r) => ({ ...r })));
    setEditMode(false);
  };

  const updateEntryStatus = (studentId: string, newStatus: AttendanceStatus) => {
    setEditedEntries((prev) =>
      prev.map((entry) =>
        entry.studentId === studentId ? { ...entry, status: newStatus } : entry
      )
    );
  };

  const saveChanges = async () => {
    if (!selectedRecord) return;
    setSaving(true);

    try {
      // Find entries that were changed
      const changes = editedEntries.filter((edited) => {
        const original = selectedRecord.records.find((r) => r.studentId === edited.studentId);
        return original && original.status !== edited.status;
      });

      if (changes.length === 0) {
        setEditMode(false);
        setSaving(false);
        return;
      }

      // Send updates to backend
      await api.put(`/teacher/${classId}/attendance/${selectedRecord.id}`, {
        updates: changes.map((c) => ({ studentId: c.studentId, status: c.status })),
      });

      // Update local state
      setRecords((prev) =>
        prev.map((r) =>
          r.id === selectedRecord.id ? { ...r, records: editedEntries } : r
        )
      );
      setSelectedRecord({ ...selectedRecord, records: editedEntries });
      setEditMode(false);
      Alert.alert('Success', `Updated ${changes.length} student(s) attendance`);
    } catch {
      Alert.alert('Error', 'Failed to update attendance');
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'present': return { name: 'checkmark-circle' as const, color: COLORS.green };
      case 'absent': return { name: 'close-circle' as const, color: COLORS.red };
      case 'late': return { name: 'time' as const, color: COLORS.yellow };
    }
  };

  const renderRecord = ({ item }: { item: AttendanceRecord }) => {
    const presentCount = item.records.filter((r) => r.status === 'present').length;
    const absentCount = item.records.filter((r) => r.status === 'absent').length;
    const lateCount = item.records.filter((r) => r.status === 'late').length;
    const total = item.records.length;
    const percentage = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    return (
      <TouchableOpacity style={styles.card} onPress={() => openRecord(item)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardDate}>{item.date}</Text>
            <Text style={styles.cardSubject}>{item.subject}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={[styles.statusBadge, item.status === 'completed' ? styles.badgeCompleted : styles.badgeProgress]}>
              <Text style={[styles.badgeText, item.status === 'completed' ? styles.badgeTextCompleted : styles.badgeTextProgress]}>
                {item.status === 'completed' ? 'Completed' : 'In Progress'}
              </Text>
            </View>
            <Text style={styles.tapHint}>Tap to view details</Text>
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
      </TouchableOpacity>
    );
  };

  const renderStudentEntry = (entry: AttendanceEntry, index: number) => {
    const icon = getStatusIcon(entry.status);
    const studentName = getStudentName(entry.studentId);

    if (!editMode) {
      return (
        <View key={entry.studentId} style={styles.studentRow}>
          <View style={styles.studentInfo}>
            <View style={styles.studentAvatar}>
              <Text style={styles.studentAvatarText}>{studentName[0]}</Text>
            </View>
            <Text style={styles.studentName}>{studentName}</Text>
          </View>
          <View style={[styles.statusChip, {
            backgroundColor: entry.status === 'present' ? '#F0FDF4' : entry.status === 'absent' ? '#FEF2F2' : '#FFFBEB',
          }]}>
            <Ionicons name={icon.name} size={16} color={icon.color} />
            <Text style={[styles.statusChipText, { color: icon.color }]}>
              {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
            </Text>
          </View>
        </View>
      );
    }

    // Edit mode
    return (
      <View key={entry.studentId} style={styles.studentRow}>
        <View style={styles.studentInfo}>
          <View style={styles.studentAvatar}>
            <Text style={styles.studentAvatarText}>{studentName[0]}</Text>
          </View>
          <Text style={styles.studentName} numberOfLines={1}>{studentName}</Text>
        </View>
        <View style={styles.editButtons}>
          <TouchableOpacity
            onPress={() => updateEntryStatus(entry.studentId, 'present')}
            style={[styles.miniBtn, entry.status === 'present' && { backgroundColor: COLORS.green }]}
          >
            <Ionicons name="checkmark" size={16} color={entry.status === 'present' ? COLORS.white : COLORS.darkGreen} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => updateEntryStatus(entry.studentId, 'absent')}
            style={[styles.miniBtn, entry.status === 'absent' && { backgroundColor: COLORS.red }]}
          >
            <Ionicons name="close" size={16} color={entry.status === 'absent' ? COLORS.white : COLORS.darkRed} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => updateEntryStatus(entry.studentId, 'late')}
            style={[styles.miniBtn, entry.status === 'late' && { backgroundColor: COLORS.yellow }]}
          >
            <Ionicons name="time" size={16} color={entry.status === 'late' ? COLORS.white : COLORS.darkYellow} />
          </TouchableOpacity>
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

      {/* Detail / Edit Modal */}
      <Modal visible={!!selectedRecord} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{selectedRecord?.subject}</Text>
              <Text style={styles.modalDate}>{selectedRecord?.date}</Text>
            </View>
            <View style={styles.modalHeaderActions}>
              {!editMode ? (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setEditMode(true)}
                >
                  <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.editBtn, { backgroundColor: '#FEF2F2' }]}
                  onPress={() => {
                    setEditMode(false);
                    if (selectedRecord) setEditedEntries(selectedRecord.records.map((r) => ({ ...r })));
                  }}
                >
                  <Ionicons name="close" size={18} color={COLORS.red} />
                  <Text style={[styles.editBtnText, { color: COLORS.red }]}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => { setSelectedRecord(null); setEditMode(false); }}
              >
                <Ionicons name="close-circle" size={28} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Summary stats */}
          {selectedRecord && (
            <View style={styles.modalStats}>
              <View style={[styles.modalStatBox, { backgroundColor: '#F0FDF4' }]}>
                <Text style={[styles.modalStatNum, { color: COLORS.green }]}>
                  {editedEntries.filter((e) => e.status === 'present').length}
                </Text>
                <Text style={styles.modalStatLabel}>Present</Text>
              </View>
              <View style={[styles.modalStatBox, { backgroundColor: '#FEF2F2' }]}>
                <Text style={[styles.modalStatNum, { color: COLORS.red }]}>
                  {editedEntries.filter((e) => e.status === 'absent').length}
                </Text>
                <Text style={styles.modalStatLabel}>Absent</Text>
              </View>
              <View style={[styles.modalStatBox, { backgroundColor: '#FFFBEB' }]}>
                <Text style={[styles.modalStatNum, { color: COLORS.yellow }]}>
                  {editedEntries.filter((e) => e.status === 'late').length}
                </Text>
                <Text style={styles.modalStatLabel}>Late</Text>
              </View>
            </View>
          )}

          <ScrollView style={styles.modalStudentList} contentContainerStyle={{ paddingBottom: 24 }}>
            {editedEntries.map((entry, index) => renderStudentEntry(entry, index))}
          </ScrollView>

          {editMode && (
            <View style={styles.saveBar}>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveChanges}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="save" size={20} color={COLORS.white} />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
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
  tapHint: { fontSize: 10, color: '#D1D5DB', marginTop: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: COLORS.gray },
  percentageBox: { marginLeft: 'auto' },
  percentageText: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: COLORS.gray, marginTop: 40 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.lightGray },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalDate: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  modalHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  closeBtn: { padding: 4 },

  // Modal stats
  modalStats: { flexDirection: 'row', padding: 16, gap: 10 },
  modalStatBox: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  modalStatNum: { fontSize: 20, fontWeight: 'bold' },
  modalStatLabel: { fontSize: 11, color: COLORS.gray, marginTop: 2 },

  // Student list in modal
  modalStudentList: { flex: 1, paddingHorizontal: 16 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  studentInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentAvatarText: { fontWeight: '600', color: COLORS.gray, fontSize: 14 },
  studentName: { fontSize: 14, fontWeight: '500', flex: 1 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusChipText: { fontSize: 12, fontWeight: '600' },

  // Edit mode buttons
  editButtons: { flexDirection: 'row', gap: 6 },
  miniBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
  },

  // Save bar
  saveBar: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
});
