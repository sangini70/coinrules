import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const USER_SETTINGS_COLLECTION = 'userSettings';

export const normalizeWatchlist = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? '').replace(/\s+/g, '').replace(/^KRW-/i, '').toUpperCase())
        .filter((item) => Boolean(item)),
    ),
  ).slice(0, 10);
};

export const loadUserWatchlist = async (uid: string) => {
  const snapshot = await getDoc(doc(db, USER_SETTINGS_COLLECTION, uid));
  if (!snapshot.exists()) return null;

  const watchlist = normalizeWatchlist(snapshot.data()?.watchlist);
  return watchlist.length > 0 ? watchlist : null;
};

export const saveUserWatchlist = async (
  uid: string,
  watchlist: string[],
  extras?: {
    emailEnabled?: boolean;
    cooldownMinutes?: number;
  },
) => {
  const payload: Record<string, unknown> = {
    watchlist: normalizeWatchlist(watchlist),
    updatedAt: serverTimestamp(),
  };

  if (typeof extras?.emailEnabled === 'boolean') {
    payload.emailEnabled = extras.emailEnabled;
  }

  if (typeof extras?.cooldownMinutes === 'number' && Number.isFinite(extras.cooldownMinutes)) {
    payload.cooldownMinutes = extras.cooldownMinutes;
  }

  await setDoc(doc(db, USER_SETTINGS_COLLECTION, uid), payload, { merge: true });
};
