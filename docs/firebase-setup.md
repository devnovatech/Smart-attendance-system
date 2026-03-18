# Firebase Setup Guide (Free Spark Plan)

> **This entire project runs on the Firebase FREE tier (Spark plan).** No credit card required.
>
> **Free Spark Plan Limits (more than enough for MVP):**
> | Service | Free Limit |
> |---------|-----------|
> | Firestore | 1 GiB storage, 50K reads/day, 20K writes/day, 20K deletes/day |
> | Authentication | Unlimited users (email/password) |
> | Storage | 5 GB stored, 1 GB/day download |
> | Hosting | 10 GB stored, 360 MB/day transfer |
>
> For a school/college attendance system, these limits easily cover hundreds of students and teachers.

## 1. Create Firebase Project (Free)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add Project"** and name it `smart-attendance-system`
3. **Disable** Google Analytics (not needed, keeps it simpler)
4. Click **Create Project**
5. **IMPORTANT:** You will be on the **Spark (free) plan** by default. Do NOT upgrade to Blaze. Everything we need is free.

## 2. Enable Authentication (Free)

1. In the left sidebar, go to **Build > Authentication**
2. Click **Get started**
3. Go to **Sign-in method** tab
4. Enable **Email/Password** provider
5. Click **Save**

> Firebase Auth is free for unlimited email/password users on all plans.

## 3. Create Firestore Database (Free)

1. In the left sidebar, go to **Build > Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (we'll add proper rules in step 7)
4. Select a region closest to your users (e.g., `us-central1`, `asia-south1`)
5. Click **Enable**

> Firestore free tier: 1 GiB storage, 50K reads/day, 20K writes/day. This is plenty for an MVP.

## 4. Set Up Firebase Storage (Free)

1. In the left sidebar, go to **Build > Storage**
2. Click **Get started**
3. Accept the default security rules for now
4. Select the same region as your Firestore

> Storage free tier: 5 GB stored, 1 GB/day downloads — enough for student photos.

## 5. Generate Service Account Key (for Backend)

1. Click the **gear icon** (top left) > **Project settings**
2. Go to **Service accounts** tab
3. Make sure **Firebase Admin SDK** is selected and language is **Node.js**
4. Click **"Generate new private key"**
5. Save the downloaded JSON file securely (never commit this to git!)
6. Use the values from this JSON for your backend `.env`:

```env
FIREBASE_PROJECT_ID=<from JSON "project_id">
FIREBASE_PRIVATE_KEY=<from JSON "private_key" — keep the quotes and \n characters>
FIREBASE_CLIENT_EMAIL=<from JSON "client_email">
FIREBASE_STORAGE_BUCKET=<project-id>.appspot.com
```

## 6. Get Web App Config (for Frontend & Mobile)

1. Go to **Project Settings > General** (scroll down)
2. Under **"Your apps"**, click the **web icon** (`</>`) to add a web app
3. Name it `smart-attendance-web`, skip Firebase Hosting
4. Click **Register app**
5. Copy the `firebaseConfig` values into your `.env` files:

For `web-frontend/.env`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=<apiKey>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<authDomain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<projectId>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<storageBucket>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<messagingSenderId>
NEXT_PUBLIC_FIREBASE_APP_ID=<appId>
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

For `mobile-app/.env`:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=<apiKey>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<authDomain>
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<projectId>
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=<storageBucket>
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<messagingSenderId>
EXPO_PUBLIC_FIREBASE_APP_ID=<appId>
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

## 7. Firestore Security Rules

Go to **Firestore Database > Rules** tab and replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isTeacher() {
      return isAuthenticated() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isAdmin();
    }

    // Timetables
    match /timetables/{timetableId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Classes
    match /classes/{classId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Attendance records
    match /attendance_records/{recordId} {
      allow read: if isAuthenticated();
      allow create: if isTeacher() || isAdmin();
      allow update: if isTeacher() || isAdmin();
    }

    // Attendance logs
    match /attendance_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated();
    }

    // Config
    match /config/{configId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Sync queue
    match /sync_queue/{itemId} {
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated();
    }
  }
}
```

Click **Publish** to save.

## 8. Firestore Indexes

Required composite indexes (create via **Firestore > Indexes > Add index**):

| Collection | Fields | Order |
|---|---|---|
| `attendance_records` | `classId` ASC, `teacherId` ASC, `date` ASC, `subject` ASC | |
| `attendance_records` | `classId` ASC, `status` ASC, `date` DESC | |
| `attendance_records` | `classId` ASC, `teacherId` ASC, `date` DESC | |
| `timetables` | `teacherId` ASC, `dayOfWeek` ASC | |

> Tip: You can also skip this step — Firestore will auto-suggest indexes when you get errors in the backend console. Just click the link in the error message to create the index.

## 9. Seed Sample Data

After completing steps 1-6 and configuring your backend `.env`:

```bash
cd backend
npm install
npm run seed
```

This creates test accounts (all free — no cost):
- **Admin**: admin@smartattendance.com / Admin@123
- **Teacher**: teacher1@smartattendance.com / Teacher@123
- **Student**: student1@smartattendance.com / Student@123

## Cost Summary

| What you're using | Cost |
|---|---|
| Firebase Auth (email/password) | **Free** |
| Firestore database | **Free** (under 50K reads/day) |
| Firebase Storage (photos) | **Free** (under 5 GB) |
| Firebase Admin SDK (backend) | **Free** |
| Total | **$0** |

You will **never be charged** on the Spark plan — there is no way to accidentally incur costs. Firebase simply stops serving requests if you hit the free limit (which is very unlikely for a school MVP).
