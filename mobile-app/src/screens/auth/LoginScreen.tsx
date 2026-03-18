import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

const COLORS = {
  primary: '#B40808',
  white: '#FFFFFF',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  border: '#D1D5DB',
};

type LoginMode = 'email' | 'studentId';

export default function LoginScreen() {
  const [mode, setMode] = useState<LoginMode>('email');
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (mode === 'email' && (!email || !password)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (mode === 'studentId' && (!studentId || !password)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      let loginEmail = email;

      if (mode === 'studentId') {
        const res = await api.post<{ success: boolean; data: { email: string } }>(
          '/auth/lookup-student-id',
          { studentId, password }
        );
        if (res.data?.email) {
          loginEmail = res.data.email;
        } else {
          Alert.alert('Login Failed', 'No student found with this ID');
          setLoading(false);
          return;
        }
      }

      await login(loginEmail, password);
    } catch {
      Alert.alert('Login Failed', mode === 'studentId' ? 'Invalid Student ID or password' : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>SA</Text>
          </View>
          <Text style={styles.title}>Smart Attendance</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        {/* Login Mode Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'email' && styles.toggleActive]}
            onPress={() => setMode('email')}
          >
            <Text style={[styles.toggleText, mode === 'email' && styles.toggleTextActive]}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'studentId' && styles.toggleActive]}
            onPress={() => setMode('studentId')}
          >
            <Text style={[styles.toggleText, mode === 'studentId' && styles.toggleTextActive]}>Student ID</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {mode === 'email' ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Student ID</Text>
              <TextInput
                style={styles.input}
                value={studentId}
                onChangeText={setStudentId}
                placeholder="Enter your Student ID"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.demoInfo}>
          <Text style={styles.demoTitle}>Demo Accounts:</Text>
          <Text style={styles.demoText}>Teacher: teacher1@smartattendance.com</Text>
          <Text style={styles.demoText}>Student: student1@smartattendance.com</Text>
          <Text style={styles.demoText}>Student ID: STU001</Text>
          <Text style={styles.demoText}>Password: Role@123 (e.g., Teacher@123)</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightGray },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 24 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: { color: COLORS.white, fontSize: 24, fontWeight: 'bold' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  subtitle: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  toggleTextActive: { color: COLORS.white },
  form: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  demoInfo: { marginTop: 24, alignItems: 'center' },
  demoTitle: { fontSize: 12, fontWeight: '600', color: COLORS.gray, marginBottom: 4 },
  demoText: { fontSize: 11, color: COLORS.gray },
});
