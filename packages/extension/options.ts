// Options page: settings live in chrome.storage.local (never .sync).
import { loadSettings, saveSettings, deleteAllLocalData, type Settings } from './settings.js';

declare const chrome: any;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = $('status');

const parseList = (value: string) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

async function ensureHostPermission(origin: string): Promise<boolean> {
  if (!origin) return true;
  try {
    const pattern = `${new URL(origin).origin}/*`;
    if (await chrome.permissions.contains({ origins: [pattern] })) return true;
    return await chrome.permissions.request({ origins: [pattern] });
  } catch {
    return false;
  }
}

async function render(): Promise<void> {
  const s = await loadSettings();
  $<HTMLInputElement>('consent').checked = s.consent;
  $<HTMLInputElement>('enabled').checked = s.enabled;
  $<HTMLInputElement>('tauS').value = String(s.tauS);
  $<HTMLInputElement>('tauH').value = String(s.tauH);
  $<HTMLInputElement>('grayBand').value = String(s.grayBand);
  $<HTMLSelectElement>('missingModalityPolicy').value = s.missingModalityPolicy;
  $<HTMLInputElement>('edgeOrigin').value = s.edgeOrigin;
  $<HTMLTextAreaElement>('allowlist').value = s.allowlist.join(', ');
  $<HTMLTextAreaElement>('denylist').value = s.denylist.join(', ');
  $<HTMLInputElement>('annotation').checked = s.annotation;
  $<HTMLInputElement>('annotationConsent').checked = s.annotationConsent;
  $<HTMLInputElement>('reduceMotion').checked = s.reduceMotion;
  syncOutputs();
}

/** Slider values are meaningless without the number next to them. */
function syncOutputs(): void {
  for (const id of ['tauS', 'tauH', 'grayBand']) {
    const input = $<HTMLInputElement>(id);
    const out = document.getElementById(`${id}-value`);
    const sync = () => {
      if (out) out.textContent = Number(input.value).toFixed(2);
    };
    input.addEventListener('input', sync);
    sync();
  }
}

$('saveBtn').addEventListener('click', async () => {
  const edgeOrigin = $<HTMLInputElement>('edgeOrigin').value.trim();
  if (!(await ensureHostPermission(edgeOrigin))) {
    status.textContent = 'Host permission denied — edge origin not saved.';
    return;
  }
  const consent = $<HTMLInputElement>('consent').checked;
  const patch: Partial<Settings> = {
    consent,
    enabled: consent && $<HTMLInputElement>('enabled').checked,
    tauS: Number($<HTMLInputElement>('tauS').value),
    tauH: Number($<HTMLInputElement>('tauH').value),
    grayBand: Number($<HTMLInputElement>('grayBand').value),
    missingModalityPolicy: $<HTMLSelectElement>('missingModalityPolicy').value as Settings['missingModalityPolicy'],
    edgeOrigin,
    allowlist: parseList($<HTMLTextAreaElement>('allowlist').value),
    denylist: parseList($<HTMLTextAreaElement>('denylist').value),
    annotation: $<HTMLInputElement>('annotation').checked,
    annotationConsent: $<HTMLInputElement>('annotationConsent').checked,
    reduceMotion: $<HTMLInputElement>('reduceMotion').checked,
  };
  await saveSettings(patch);
  status.textContent = 'Settings saved.';
});

$('deleteBtn').addEventListener('click', async () => {
  if (!confirm('Delete all stored data (settings, annotations, cache)?')) return;
  await deleteAllLocalData();
  await render();
  status.textContent = 'All local data deleted.';
});

$('exportBtn').addEventListener('click', () => {
  chrome.storage.local.get(['annotations'], (data: any) => {
    const blob = new Blob([JSON.stringify(data.annotations ?? [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'slop-filter-annotations.json';
    a.click();
    URL.revokeObjectURL(url);
  });
});

render();
