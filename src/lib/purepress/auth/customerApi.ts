"use client";

import { signOut, type User } from "firebase/auth";
import { auth } from "@/utils/firebaseConfig";
import { clearPendingPurePressSignInEmail } from "./client";
import { clearPurePressCustomerOfflineData } from "../offline/customer";

export async function purePressCustomerFetch(user: User, input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(input, { ...init, headers, cache: "no-store" });
}

export async function signOutPurePressCustomer(user: User) {
  const uid = user.uid;
  try {
    await clearPurePressCustomerOfflineData(uid);
  } finally {
    clearPendingPurePressSignInEmail();
    await signOut(auth);
  }
}
