'use client';

import { useEffect, useState } from 'react';
import { useRouter }            from 'next/navigation';
import { auth, firestore }      from '@/utils/firebaseConfig';
import {
  isSignInWithEmailLink,
  signInWithEmailLink
} from 'firebase/auth';
import { doc, getDoc }          from 'firebase/firestore';
import AdminHubLoader           from '@/components/AdminHubLoader';

export default function CallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    // 1️⃣ Only run in browser
    if (typeof window === 'undefined') return;

    // 2️⃣ Make sure this is a valid magic link
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setError('Invalid or expired link.');
      return;
    }

    // 3️⃣ Pull email (must have been stored before sendSignInLinkToEmail)
    const email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      setError('Missing email. Please request a new link.');
      return;
    }

    // 4️⃣ Sign in with the link
    signInWithEmailLink(auth, email, window.location.href)
      .then(async ({ user }) => {
        // 5️⃣ Clean up
        window.localStorage.removeItem('emailForSignIn');

        // 6️⃣ Look up their role in Firestore
        const profileSnap = await getDoc(doc(firestore, 'profiles', user.uid));
        const role = profileSnap.data()?.role;

        // 7️⃣ Route based on role
        if (role === 'Admin') {
          router.push('/admin/dashboard');
        } else if (role === 'Client') {
          router.push('/client/dashboard');
        } else {
          setError('No valid role found. Please contact support.');
        }
      })
      .catch((e) => setError('Sign-in failed: ' + e.message));
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <h1 className="text-2xl text-red-500 mb-2">❌ {error}</h1>
          <p>Please request a new magic link or contact support.</p>
        </div>
      </div>
    );
  }

  // While loading/signing in
  return <AdminHubLoader />;
}
