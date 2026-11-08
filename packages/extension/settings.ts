// Extension settings — local-first (chrome.storage.local, never .sync).
declare const chrome: any;

export type MissingPolicy = 'suspend' | 'treat_safe' | 'treat_risky';

export interface Settings {
  enabled: boolean;
  /** First-run consent acknowledged. */
  consent: boolean;
  /** Edge base URL. Empty string ⇒ fully offline (no network at all). */
  edgeOrigin: string;
  tauS: number;
  tauH: number;
  grayBand: number;
  missingModalityPolicy: MissingPolicy;
  annotation: boolean;
  annotationConsent: boolean;
  allowlist: string[];
  denylist: string[];
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: false,
  consent: false,
  edgeOrigin: '',
  tauS: 0.6,
  tauH: 0.6,
  grayBand: 0.1,
  missingModalityPolicy: 'suspend',
  annotation: false,
  annotationConsent: false,
  allowlist: [],
  denylist: [],
  reduceMotion: false,
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(patch);
}

/** Delete ALL local data: settings, annotations and the verdict cache. */
export async function deleteAllLocalData(): Promise<void> {
  await chrome.storage.local.clear();
  if (typeof indexedDB !== 'undefined') {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('slop-filter');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  }
}
