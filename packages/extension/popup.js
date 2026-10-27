document.addEventListener('DOMContentLoaded', () => {
  const enableChk = document.getElementById('enable');
  const prefixInput = document.getElementById('prefix');
  const addBtn = document.getElementById('addBtn');

  addBtn.addEventListener('click', () => {
    const prefix = prefixInput.value.trim();
    if (!prefix) {
      alert('Enter a prefix');
      return;
    }
    chrome.runtime.sendMessage({ type: 'addPrefix', prefix }, (response) => {
      console.log('Popup sent addPrefix:', response);
    });
  });

  // Enable filter toggle
  enableChk.addEventListener('change', () => {
    chrome.runtime.sendMessage({ type: 'enableFilter', enabled: enableChk.checked });
  });

  // New Bloom POST button
  const bloomBtn = document.getElementById('bloomBtn');
  bloomBtn.addEventListener('click', () => {
    const prefix = prefixInput.value.trim();
    if (!prefix) {
      alert('Enter a prefix for Bloom POST');
      return;
    }
    chrome.runtime.sendMessage({ type: 'bloomFilter', prefix }, (response) => {
      console.log('Popup sent bloomFilter:', response);
    });
  });
});