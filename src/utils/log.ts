// src/utils/log.ts
import { getAnalyticsClient } from './firebaseConfig';
import { logEvent as firebaseLogEvent } from 'firebase/analytics';

export async function logAnalyticsEvent(
  eventName: string,
  params?: Record<string, any>
) {
  const analytics = await getAnalyticsClient();
  if (analytics) {
    firebaseLogEvent(analytics as any, eventName, params);
  }
}
