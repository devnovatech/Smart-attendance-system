# Deployment Guide

## Backend - Firebase Cloud Run / Railway / Render

### Option 1: Docker Deploy (Railway/Render)

1. Push to GitHub
2. Connect repo to Railway/Render
3. Set root directory to `backend/`
4. Set environment variables from `.env.example`
5. Deploy

### Option 2: Docker Compose (VPS)

```bash
# On your server
git clone <your-repo>
cd smart-attendance-system

# Copy and configure env files
cp backend/.env.example backend/.env
cp web-frontend/.env.example web-frontend/.env
# Edit both .env files with production values

# Build and start
docker-compose up -d --build
```

## Web Frontend - Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. From the project root:

```bash
cd web-frontend
vercel
```

3. Set environment variables in Vercel Dashboard:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_API_URL` (your backend URL)

4. Deploy: `vercel --prod`

## Mobile App - Expo EAS

1. Install EAS CLI: `npm i -g eas-cli`
2. Login: `eas login`
3. Configure:

```bash
cd mobile-app
eas build:configure
```

4. Build:

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

5. Submit to stores:

```bash
eas submit --platform ios
eas submit --platform android
```

## Environment Checklist

### Backend Production `.env`
- [ ] `NODE_ENV=production`
- [ ] `PORT=5000`
- [ ] Firebase credentials set
- [ ] `JWT_SECRET` set to a strong random value
- [ ] `CORS_ORIGIN` set to frontend URL
- [ ] Rate limiting configured

### Security Checklist
- [ ] HTTPS enforced on all endpoints
- [ ] Firebase Security Rules deployed
- [ ] Firestore indexes created
- [ ] Environment variables not committed to git
- [ ] Rate limiting enabled
- [ ] CORS properly configured
