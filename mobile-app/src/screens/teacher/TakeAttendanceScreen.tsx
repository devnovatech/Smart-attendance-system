import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import { addToSyncQueue } from '../../lib/offline';
import { ApiResponse, User, AttendanceStatus } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

interface StudentItem {
  student: User;
  status: AttendanceStatus | null;
}

export default function TakeAttendanceScreen({ route, navigation }: { route: any; navigation: any }) {
  const { classId, subject } = route.params;
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const res = await api.get<ApiResponse<User[]>>(`/teacher/${classId}/students`);
      if (res.data) {
        setStudents(res.data.map((s) => ({ student: s, status: null })));
      }
    } catch {
      Alert.alert('Error', 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const markStudent = async (status: AttendanceStatus) => {
    const student = students[currentIndex];
    if (!student) return;

    try {
      await api.post(`/teacher/${classId}/attendance`, { studentId: student.student.uid, status });
    } catch {
      await addToSyncQueue({
        action: 'MARK_ATTENDANCE',
        data: { classId, studentId: student.student.uid, status, date: new Date().toISOString().split('T')[0], subject },
        createdAt: new Date().toISOString(),
      });
    }

    setStudents((prev) =>
      prev.map((s, i) => (i === currentIndex ? { ...s, status } : s))
    );

    // Auto-advance to next unmarked student
    if (currentIndex < students.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }
  };

  const handleSubmit = async () => {
    const unmarked = students.filter((s) => s.status === null);
    if (unmarked.length > 0) {
      Alert.alert(
        'Unmarked Students',
        `${unmarked.length} students haven't been marked and will be set as absent. Continue?`,
        [
          { text: 'Go Back', style: 'cancel' },
          { text: 'Submit', onPress: () => submitAttendance() },
        ]
      );
      return;
    }
    await submitAttendance();
  };

  const submitAttendance = async () => {
    setSubmitting(true);
    try {
      await api.post(`/teacher/${classId}/attendance/submit`, { confirmSkipped: true });
      Alert.alert('Success', 'Attendance submitted successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const presentCount = students.filter((s) => s.status === 'present').length;
  const absentCount = students.filter((s) => s.status === 'absent').length;
  const lateCount = students.filter((s) => s.status === 'late').length;
  const markedCount = presentCount + absentCount + lateCount;
  const currentStudent = students[currentIndex];

  const goToStudent = (index: number) => {
    if (index >= 0 && index < students.length) {
      setCurrentIndex(index);
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  };

  const renderStudentCard = ({ item, index }: { item: StudentItem; index: number }) => {
    const isActive = index === currentIndex;
    return (
      <TouchableOpacity
        onPress={() => goToStudent(index)}
        style={[
          styles.miniCard,
          isActive && styles.miniCardActive,
          item.status === 'present' && styles.miniCardPresent,
          item.status === 'absent' && styles.miniCardAbsent,
          item.status === 'late' && styles.miniCardLate,
        ]}
      >
        {item.student.photoURL ? (
          <Image source={{ uri: item.student.photoURL }} style={styles.miniAvatar} />
        ) : (
          <View style={[styles.miniAvatar, styles.miniAvatarPlaceholder]}>
            <Text style={styles.miniAvatarText}>{item.student.displayName[0]}</Text>
          </View>
        )}
        {item.status && (
          <View style={[
            styles.miniStatusDot,
            item.status === 'present' && { backgroundColor: COLORS.green },
            item.status === 'absent' && { backgroundColor: COLORS.red },
            item.status === 'late' && { backgroundColor: COLORS.yellow },
          ]} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{subject}</Text>
          <Text style={styles.counter}>{markedCount}/{students.length}</Text>
        </View>
        <Text style={styles.date}>{new Date().toLocaleDateString()}</Text>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: '#F0FDF4' }]}>
          <Text style={[styles.statNum, { color: COLORS.green }]}>{presentCount}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#FEF2F2' }]}>
          <Text style={[styles.statNum, { color: COLORS.red }]}>{absentCount}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#FFFBEB' }]}>
          <Text style={[styles.statNum, { color: COLORS.yellow }]}>{lateCount}</Text>
          <Text style={styles.statLabel}>Late</Text>
        </View>
      </View>

      {/* Student Thumbnail Strip */}
      <FlatList
        ref={flatListRef}
        data={students}
        renderItem={renderStudentCard}
        keyExtractor={(item) => item.student.uid}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripContainer}
        getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
      />

      {/* Current Student Display */}
      {currentStudent && (
        <View style={styles.studentDisplay}>
          {/* Navigation Arrows */}
          <View style={styles.navRow}>
            <TouchableOpacity
              onPress={() => goToStudent(currentIndex - 1)}
              disabled={currentIndex === 0}
              style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
            >
              <Ionicons name="chevron-back" size={24} color={currentIndex === 0 ? '#D1D5DB' : COLORS.gray} />
            </TouchableOpacity>

            <View style={styles.studentCenter}>
              {/* Photo */}
              {currentStudent.student.photoURL ? (
                <Image source={{ uri: currentStudent.student.photoURL }} style={styles.studentPhoto} />
              ) : (
                <View style={[styles.studentPhoto, styles.photoPlaceholder]}>
                  <Text style={styles.photoPlaceholderText}>
                    {currentStudent.student.displayName[0]}
                  </Text>
                </View>
              )}

              {/* Name & Info */}
              <Text style={styles.studentName}>{currentStudent.student.displayName}</Text>
              <Text style={styles.studentMeta}>
                {currentStudent.student.rollNumber}
                {currentStudent.student.studentId ? ` | ${currentStudent.student.studentId}` : ''}
              </Text>
              {currentStudent.student.department && (
                <Text style={styles.studentDept}>{currentStudent.student.department}</Text>
              )}

              {/* Current Status */}
              {currentStudent.status && (
                <View style={[
                  styles.currentStatusBadge,
                  currentStudent.status === 'present' && { backgroundColor: '#F0FDF4', borderColor: COLORS.green },
                  currentStudent.status === 'absent' && { backgroundColor: '#FEF2F2', borderColor: COLORS.red },
                  currentStudent.status === 'late' && { backgroundColor: '#FFFBEB', borderColor: COLORS.yellow },
                ]}>
                  <Ionicons
                    name={currentStudent.status === 'present' ? 'checkmark-circle' : currentStudent.status === 'absent' ? 'close-circle' : 'time'}
                    size={16}
                    color={currentStudent.status === 'present' ? COLORS.green : currentStudent.status === 'absent' ? COLORS.red : COLORS.yellow}
                  />
                  <Text style={[
                    styles.currentStatusText,
                    currentStudent.status === 'present' && { color: COLORS.darkGreen },
                    currentStudent.status === 'absent' && { color: COLORS.darkRed },
                    currentStudent.status === 'late' && { color: COLORS.darkYellow },
                  ]}>
                    {currentStudent.status.charAt(0).toUpperCase() + currentStudent.status.slice(1)}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={() => goToStudent(currentIndex + 1)}
              disabled={currentIndex === students.length - 1}
              style={[styles.navBtn, currentIndex === students.length - 1 && styles.navBtnDisabled]}
            >
              <Ionicons name="chevron-forward" size={24} color={currentIndex === students.length - 1 ? '#D1D5DB' : COLORS.gray} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom Action Buttons */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.presentButton, currentStudent?.status === 'present' && styles.presentButtonActive]}
          onPress={() => markStudent('present')}
        >
          <Ionicons name="checkmark-circle" size={28} color={currentStudent?.status === 'present' ? COLORS.white : COLORS.darkGreen} />
          <Text style={[styles.actionButtonText, styles.presentText, currentStudent?.status === 'present' && styles.actionButtonTextActive]}>
            Present
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.absentButton, currentStudent?.status === 'absent' && styles.absentButtonActive]}
          onPress={() => markStudent('absent')}
        >
          <Ionicons name="close-circle" size={28} color={currentStudent?.status === 'absent' ? COLORS.white : COLORS.darkRed} />
          <Text style={[styles.actionButtonText, styles.absentText, currentStudent?.status === 'absent' && styles.actionButtonTextActive]}>
            Absent
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.lateButton, currentStudent?.status === 'late' && styles.lateButtonActive]}
          onPress={() => markStudent('late')}
        >
          <Ionicons name="time" size={28} color={currentStudent?.status === 'late' ? COLORS.white : COLORS.darkYellow} />
          <Text style={[styles.actionButtonText, styles.lateText, currentStudent?.status === 'late' && styles.actionButtonTextActive]}>
            Late
          </Text>
        </TouchableOpacity>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.submitText}>Submit Attendance ({markedCount}/{students.length})</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightGray },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
  counter: { fontSize: 14, color: COLORS.gray, fontWeight: '600' },
  date: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, marginVertical: 8, gap: 8 },
  statBox: { flex: 1, borderRadius: 10, padding: 8, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 10, color: COLORS.gray, marginTop: 1 },

  // Thumbnail strip
  stripContainer: { paddingHorizontal: 16, paddingVertical: 8 },
  miniCard: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  miniCardActive: { borderColor: COLORS.primary },
  miniCardPresent: { borderColor: COLORS.green },
  miniCardAbsent: { borderColor: COLORS.red },
  miniCardLate: { borderColor: COLORS.yellow },
  miniAvatar: { width: 40, height: 40, borderRadius: 20 },
  miniAvatarPlaceholder: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: { fontWeight: '600', color: COLORS.gray, fontSize: 14 },
  miniStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.lightGray,
  },

  // Current student display
  studentDisplay: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  navBtn: { padding: 8 },
  navBtnDisabled: { opacity: 0.3 },
  studentCenter: { alignItems: 'center', flex: 1 },
  studentPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 12,
  },
  photoPlaceholder: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.gray,
  },
  studentName: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  studentMeta: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
  studentDept: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  currentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  currentStatusText: { fontSize: 14, fontWeight: '600' },

  // Bottom action buttons
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 2,
  },
  presentButton: { backgroundColor: '#F0FDF4', borderColor: COLORS.green },
  presentButtonActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  absentButton: { backgroundColor: '#FEF2F2', borderColor: COLORS.red },
  absentButtonActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  lateButton: { backgroundColor: '#FFFBEB', borderColor: COLORS.yellow },
  lateButtonActive: { backgroundColor: COLORS.yellow, borderColor: COLORS.yellow },
  actionButtonText: { fontSize: 14, fontWeight: '700' },
  actionButtonTextActive: { color: COLORS.white },
  presentText: { color: COLORS.darkGreen },
  absentText: { color: COLORS.darkRed },
  lateText: { color: COLORS.darkYellow },

  // Submit
  submitBtn: {
    marginHorizontal: 16,
    marginBottom: 24,
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  submitText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
});
