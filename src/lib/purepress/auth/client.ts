"use client";

import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  type User,
} from "firebase/auth";
import { auth } from "@/utils/firebaseConfig";

const PUREPRESS_EMAIL_LINK_KEY = "purepress:pending-signin-email";

export function normalizePurePressEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function sendPurePressCustomerSignInLink(email: string, continueUrl: string) {
  const normalizedEmail = normalizePurePressEmail(email);
  if (!normalizedEmail) throw new Error("An email address is required.");

  await sendSignInLinkToEmail(auth, normalizedEmail, {
    url: continueUrl,
    handleCodeInApp: true,
  });

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(PUREPRESS_EMAIL_LINK_KEY, normalizedEmail);
  }
}

export function isPurePressCustomerSignInLink(url?: string) {
  const candidate = url ?? (typeof window !== "undefined" ? window.location.href : "");
  return Boolean(candidate) && isSignInWithEmailLink(auth, candidate);
}

export function pendingPurePressSignInEmail() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(PUREPRESS_EMAIL_LINK_KEY) ?? "";
}

export function clearPendingPurePressSignInEmail() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(PUREPRESS_EMAIL_LINK_KEY);
}

export async function completePurePressCustomerSignIn(email: string, url?: string): Promise<User> {
  const normalizedEmail = normalizePurePressEmail(email);
  const candidate = url ?? (typeof window !== "undefined" ? window.location.href : "");
  if (!normalizedEmail || !candidate || !isSignInWithEmailLink(auth, candidate)) {
    throw new Error("The PurePress sign-in link is incomplete or invalid.");
  }

  const credential = await signInWithEmailLink(auth, normalizedEmail, candidate);
  clearPendingPurePressSignInEmail();
  return credential.user;
}
