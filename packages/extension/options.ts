// Options page script
const thresholdInput = document.getElementById('threshold') as HTMLInputElement;
const thresholdValueSpan = document.getElementById('thresholdValue') as HTMLSpanElement;
const allowlistInput = document.getElementById('allowlist') as HTMLTextAreaElement;
const denylistInput = document.getElementById('denylist') as HTMLTextAreaElement;
const annotationCheckbox = document.getElementById('annotation') as HTMLInputElement;
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
const deleteBtn = document.getElementById('deleteBtn') as HTMLButtonElement;

thresholdInput?.addEventListener('input', () => {
  if (thresholdValueSpan) {
    thresholdValueSpan.textContent = parseFloat(thresholdInput.value).toFixed(2);
  }
});

// Load current settings
chrome.storage.sync.get(['slopThreshold', 'allowlist', 'denylist', 'annotation'], (data) => {
  const thresh = data.slopThreshold !== undefined ? (data.slopThreshold as number) : 0.5;
  if (thresholdInput) thresholdInput.value = thresh.toString();
  if (thresholdValueSpan) thresholdValueSpan.textContent = parseFloat(thresh.toString()).toFixed(2);
  if (allowlistInput) allowlistInput.value = (data.allowlist as string) || '';
  if (denylistInput) denylistInput.value = (data.denylist as string) || '';
  if (annotationCheckbox) annotationCheckbox.checked = !!data.annotation;
});

// Save settings
saveBtn?.addEventListener('click', () => {
  const settings = {
    slopThreshold: parseFloat(thresholdInput.value),
    allowlist: allowlistInput.value,
    denylist: denylistInput.value,
    annotation: annotationCheckbox.checked,
  };
  chrome.storage.sync.set(settings, () => {
    alert('Settings saved');
  });
});

// Delete all data
deleteBtn?.addEventListener('click', () => {
  if (confirm('Delete all stored data?')) {
    chrome.storage.sync.clear(() => {
      alert('All data cleared');
      location.reload();
    });
  }
});

// Export annotations
const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
exportBtn?.addEventListener('click', () => {
  chrome.storage.sync.get(null, (data) => {
    const annotations = Object.entries(data)
      .filter(([k]) => k.startsWith('annotation_'))
      .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {});
    const blob = new Blob([JSON.stringify(annotations, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotations.json';
    a.click();
    URL.revokeObjectURL(url);
  });
});
