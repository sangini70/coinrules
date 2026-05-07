import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const USER_SETTINGS_COLLECTION = 'userSettings';
const DEFAULT_SELECTED_COIN = '';

export type UserSettings = {
  watchlist: string[];
  selectedCoin: string;
  emailTo?: string;
  emailEnabled?: boolean;
  cooldownMinutes?: number;
};

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

export const normalizeSelectedCoin = (value: unknown) => {
  const raw = String(value ?? '').replace(/\s+/g, '').toUpperCase();
  if (!raw) return DEFAULT_SELECTED_COIN;
  return raw.startsWith('KRW-') ? raw : `KRW-${raw}`;
};

export const loadUserWatchlist = async (uid: string) => {
  const settings = await loadUserSettings(uid);
  return settings?.watchlist ?? null;
};

export const loadUserSettings = async (uid: string): Promise<UserSettings | null> => {
  const snapshot = await getDoc(doc(db, USER_SETTINGS_COLLECTION, uid));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  const watchlist = normalizeWatchlist(data?.watchlist);
  const selectedCoin = normalizeSelectedCoin(data?.selectedCoin);

  return {
    watchlist,
    selectedCoin,
    emailTo: typeof data?.emailTo === 'string' ? data.emailTo : undefined,
    emailEnabled: typeof data?.emailEnabled === 'boolean' ? data.emailEnabled : undefined,
    cooldownMinutes: typeof data?.cooldownMinutes === 'number' ? data.cooldownMinutes : undefined,
  };
};

export const saveUserSettings = async (
  uid: string,
  settings: UserSettings,
) => {
  const payload: Record<string, unknown> = {
    watchlist: normalizeWatchlist(settings.watchlist),
    selectedCoin: normalizeSelectedCoin(settings.selectedCoin),
    updatedAt: serverTimestamp(),
  };

  if (typeof settings.emailTo === 'string' && settings.emailTo.trim()) {
    payload.emailTo = settings.emailTo.trim();
  }

  if (typeof settings.emailEnabled === 'boolean') {
    payload.emailEnabled = settings.emailEnabled;
  }

  if (typeof settings.cooldownMinutes === 'number' && Number.isFinite(settings.cooldownMinutes)) {
    payload.cooldownMinutes = settings.cooldownMinutes;
  }

  await setDoc(doc(db, USER_SETTINGS_COLLECTION, uid), payload, { merge: true });
};

export const saveUserWatchlist = async (
  uid: string,
  watchlist: string[],
  extras?: {
    emailEnabled?: boolean;
    cooldownMinutes?: number;
    selectedCoin?: string;
    emailTo?: string;
  },
) => {
  await saveUserSettings(uid, {
    watchlist,
    selectedCoin: normalizeSelectedCoin(extras?.selectedCoin ?? DEFAULT_SELECTED_COIN),
    emailTo: extras?.emailTo,
    emailEnabled: extras?.emailEnabled,
    cooldownMinutes: extras?.cooldownMinutes,
  });
};
