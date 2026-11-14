import { loadSettings, saveSettings } from './settings.js';

declare const chrome: any;

const enableChk = document.getElementById('enable') as HTMLInputElement;
const status = document.getElementById('status') as HTMLElement;

loadSettings().then((s) => {
  enableChk.checked = s.enabled;
});

enableChk.addEventListener('change', async () => {
  if (enableChk.checked) {
    const s = await loadSettings();
    if (!s.consent) {
      enableChk.checked = false;
      status.textContent = 'Open Settings to give consent first.';
      return;
    }
  }
  await saveSettings({ enabled: enableChk.checked });
  status.textContent = enableChk.checked ? 'Filter enabled.' : 'Filter disabled.';
});

document.getElementById('analyzeBtn')!.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'startAnalysis' }, () => {
    if (chrome.runtime.lastError) status.textContent = chrome.runtime.lastError.message;
    else status.textContent = 'Analysis started.';
  });
});
