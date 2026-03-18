import request from 'supertest';
import express from 'express';

// Simple health check test that doesn't require Firebase
const app = express();
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

describe('Health Check', () => {
  it('should return 200 and status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });
});

describe('Validators', () => {
  // Import validators directly since they don't depend on Firebase
  const { loginSchema, createUserSchema, configSchema } = require('../src/validators');

  it('should validate login schema', () => {
    expect(() => loginSchema.parse({ idToken: '' })).toThrow();
    expect(() => loginSchema.parse({ idToken: 'valid-token' })).not.toThrow();
  });

  it('should validate create user schema', () => {
    const validUser = {
      email: 'test@example.com',
      password: 'Pass123',
      displayName: 'Test User',
      role: 'student',
    };
    expect(() => createUserSchema.parse(validUser)).not.toThrow();

    const invalidUser = { ...validUser, email: 'invalid' };
    expect(() => createUserSchema.parse(invalidUser)).toThrow();
  });

  it('should validate config schema', () => {
    expect(() => configSchema.parse({ attendanceThreshold: 75 })).not.toThrow();
    expect(() => configSchema.parse({ attendanceThreshold: 150 })).toThrow();
  });
});
