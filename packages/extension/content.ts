import { extractFeatures, AudioInput } from '../features/src/index';

// Overlay injection for Slop Filter
const overlay = document.createElement('div');
overlay.id = 'slop-filter-overlay';
overlay.style.position = 'fixed';
overlay.style.top = '10px';
overlay.style.right = '10px';
overlay.style.padding = '8px';
overlay.style.backgroundColor = 'rgba(255,0,0,0.8)';
overlay.style.color = '#fff';
overlay.style.zIndex = '2147483647';
overlay.style.fontFamily = 'Arial, sans-serif';
overlay.style.fontSize = '12px';
overlay.style.borderRadius = '4px';
overlay.innerHTML = `<div id="slop-indicator">Slop detected</div>
  <ul id="slop-explanations" style="margin:4px 0;padding-left:20px;"></ul>
  <button id="slop-show-anyway" style="margin-top:4px;">Show anyway</button>`;

const explanations = ['Audio quality', 'Video bitrate', 'Caption accuracy'];
const ul = overlay.querySelector('#slop-explanations');
explanations.forEach(text => {
  const li = document.createElement('li');
  li.textContent = text;
  ul.appendChild(li);
});
document.body.appendChild(overlay);

overlay.querySelector('#slop-show-anyway').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'allowShow' });
  overlay.style.display = 'none';
});

// Annotation mode helper
function createAnnotationButton() {
  const btn = document.createElement('button');
  btn.textContent = 'Annotate';
  btn.style.position = 'fixed';
  btn.style.bottom = '20px';
  btn.style.right = '20px';
  btn.style.zIndex = '2147483647';
  btn.style.padding = '6px 12px';
  btn.style.background = '#007bff';
  btn.style.color = '#fff';
  btn.style.border = 'none';
  btn.style.borderRadius = '4px';
  document.body.appendChild(btn);
  btn.addEventListener('click', showAnnotationModal);
}

function showAnnotationModal() {
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%,-50%)';
  modal.style.background = '#fff';
  modal.style.padding = '20px';
  modal.style.zIndex = '2147483648';
  modal.style.border = '1px solid #ccc';
  modal.style.borderRadius = '4px';
  modal.innerHTML = `<h3>Annotate Slop</h3>`;

  const textarea = document.createElement('textarea');
  textarea.style.width = '100%';
  textarea.style.height = '80px';
  modal.appendChild(textarea);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.style.marginTop = '10px';
  modal.appendChild(saveBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.marginLeft = '8px';
  modal.appendChild(cancelBtn);

  document.body.appendChild(modal);

  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  saveBtn.addEventListener('click', () => {
    const note = textarea.value;
    const key = `annotation_${location.href}`;
    chrome.storage.sync.set({ [key]: note }, () => {
      console.log('Annotation saved');
      document.body.removeChild(modal);
    });
  });
}

// Check annotation mode flag
chrome.storage.sync.get(['annotation'], ({ annotation }) => {
  if (annotation) {
    createAnnotationButton();
  }
});

// Capture audio from the YouTube video element and extract features.
const captureDurationSec = 1; // seconds to capture

function startCapture() {
  const video = document.querySelector('video');
  if (!video) {
    console.warn('No video element found on page.');
    return;
  }

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const source = audioCtx.createMediaElementSource(video);
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);

  const bufferChunks: Float32Array[] = [];

  processor.onaudioprocess = (e) => {
    const channelData = e.inputBuffer.getChannelData(0);
    bufferChunks.push(new Float32Array(channelData));
  };

  source.connect(processor);
  processor.connect(audioCtx.destination);

  // Stop after desired duration
  setTimeout(() => {
    processor.disconnect();
    source.disconnect();
    const totalLength = bufferChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const data = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of bufferChunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }
    const input: AudioInput = { data, sampleRate: audioCtx.sampleRate };
    const result = extractFeatures(input);
    console.log('Extracted features from captured audio:', result);
    // Send extracted features to background
    chrome.runtime.sendMessage({ type: 'extractFeatures', features: result }, (response) => {
      console.log('Background responded to feature extraction:', response);
    });
    // Optional: also send raw audio if needed
    chrome.runtime.sendMessage({ type: 'audioCapture', audio: data, sampleRate: audioCtx.sampleRate });
  }, captureDurationSec * 1000);
}

// Start capture when the page is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  startCapture();
} else {
  document.addEventListener('DOMContentLoaded', startCapture);
}

