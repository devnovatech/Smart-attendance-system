import { Request, Response } from 'express';
import { auth, db } from '../config/firebase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;

    const decodedToken = await auth.verifyIdToken(idToken);
    const { uid, email } = decodedToken;

    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      res.status(404).json({ success: false, error: 'User not found in system' });
      return;
    }

    const userData = userDoc.data();

    // Set custom claims for role
    await auth.setCustomUserClaims(uid, { role: userData?.role });

    const token = jwt.sign(
      { uid, email, role: userData?.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          uid,
          email,
          displayName: userData?.displayName,
          role: userData?.role,
          department: userData?.department,
          photoURL: userData?.photoURL,
        },
      },
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

export const lookupStudentId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId } = req.body;

    const snapshot = await db
      .collection('users')
      .where('studentId', '==', studentId)
      .where('role', '==', 'student')
      .limit(1)
      .get();

    if (snapshot.empty) {
      res.status(404).json({ success: false, error: 'No student found with this ID' });
      return;
    }

    const userData = snapshot.docs[0].data();
    res.json({
      success: true,
      data: { email: userData.email },
    });
  } catch (error) {
    console.error('lookupStudentId error:', error);
    res.status(500).json({ success: false, error: 'Failed to look up student ID' });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    // Verify the existing token
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as { uid: string; email: string; role: string };

    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const userData = userDoc.data();

    const newToken = jwt.sign(
      { uid: decoded.uid, email: decoded.email, role: userData?.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      data: { token: newToken },
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const userDoc = await db.collection('users').doc(req.user.uid).get();

    if (!userDoc.exists) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: { id: userDoc.id, ...userDoc.data() },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
};
