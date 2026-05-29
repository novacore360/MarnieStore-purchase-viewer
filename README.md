# Marnie Store – Customer Purchase Viewer

A React PWA that reads customer purchase data from Firebase Firestore.

---

## Deploy to Render

### Option A – Using render.yaml (recommended)

1. Push this repo to GitHub.
2. In Render → **New → Blueprint** → connect the repo.  
   Render will read `render.yaml` and configure everything automatically.
3. Add your Firebase environment variables in the Render dashboard  
   (Dashboard → your service → Environment).

### Option B – Manual Web Service

| Field | Value |
|-------|-------|
| **Environment** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run serve` |
| **Node version** | `20.18.0` |

### Required Environment Variables

Set these in Render → Environment (do **not** commit them):

```
REACT_APP_FIREBASE_API_KEY
REACT_APP_FIREBASE_AUTH_DOMAIN
REACT_APP_FIREBASE_PROJECT_ID
REACT_APP_FIREBASE_STORAGE_BUCKET
REACT_APP_FIREBASE_MESSAGING_SENDER_ID
REACT_APP_FIREBASE_APP_ID
REACT_APP_FIREBASE_MEASUREMENT_ID
```

---

## Local Development

```bash
# 1. Copy and fill in your Firebase config
cp .env.example .env.local

# 2. Install and run
npm install
npm start
```

`.env.local` template:
```
REACT_APP_FIREBASE_API_KEY=your_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```
