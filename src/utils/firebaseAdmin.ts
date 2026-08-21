import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function serviceAccount() {
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) throw new Error("Firebase Admin is not configured.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_ADMIN_KEY is not valid JSON.");
  }
}

export function isFirebaseAdminConfigured() {
  return Boolean(process.env.FIREBASE_ADMIN_KEY?.trim());
}

export function getAdminApp(): App {
  if (getApps().length) return getApp();
  return initializeApp({ credential: cert(serviceAccount()) });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminMessaging() {
  return getMessaging(getAdminApp());
}
