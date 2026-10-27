// Options page script
const thresholdInput = document.getElementById('threshold');
const allowlistInput = document.getElementById('allowlist');
const denylistInput = document.getElementById('denylist');
const annotationCheckbox = document.getElementById('annotation');
const saveBtn = document.getElementById('saveBtn');
const deleteBtn = document.getElementById('deleteBtn');

// Load current settings
chrome.storage.sync.get(['slopThreshold','allowlist','denylist','annotation'], data => {
  thresholdInput.value = data.slopThreshold !== undefined ? data.slopThreshold : 0.5;
  allowlistInput.value = data.allowlist || '';
  denylistInput.value = data.denylist || '';
  annotationCheckbox.checked = !!data.annotation;
});

// Save settings
saveBtn.addEventListener('click', () => {
  const settings = {
    slopThreshold: parseFloat(thresholdInput.value),
    allowlist: allowlistInput.value,
    denylist: denylistInput.value,
    annotation: annotationCheckbox.checked
  };
  chrome.storage.sync.set(settings, () => {
    alert('Settings saved');
  });
});

// Delete all data
deleteBtn.addEventListener('click', () => {
  if (confirm('Delete all stored data?')) {
    chrome.storage.sync.clear(() => {
      alert('All data cleared');
      location.reload();
    });
  }
});

// Export annotations
const exportBtn = document.getElementById('exportBtn');
exportBtn.addEventListener('click', () => {
  chrome.storage.sync.get(null, data => {
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