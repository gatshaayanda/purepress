import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { type Analytics } from 'firebase/analytics'
import { getStorage } from 'firebase/storage' // ✅ Import storage

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!,
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
const app = firebaseApp

export const auth = getAuth(app)
if (
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === 'true'
) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
}

export const firestore = getFirestore(app)
if (
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === 'true'
) {
  connectFirestoreEmulator(firestore, 'localhost', 8080)
}

export const storage = getStorage(app) // ✅ Add export

let _analytics: Analytics | null = null

export async function getAnalyticsClient(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null
  const { isSupported, getAnalytics } = await import('firebase/analytics')
  if (await isSupported()) {
    _analytics ||= getAnalytics(app)
    return _analytics
  }
  return null
}

