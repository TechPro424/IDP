// Background service worker
console.log('Slop Filter background worker loaded');

interface Settings {
  slopThreshold: number;
  allowlist: string[];
  denylist: string[];
}

// Load settings from storage
const settings: Settings = { slopThreshold: 0.5, allowlist: [], denylist: [] };
chrome.storage.sync.get(['slopThreshold', 'allowlist', 'denylist'], (data) => {
  settings.slopThreshold = typeof data.slopThreshold === 'number' ? data.slopThreshold : 0.5;
  settings.allowlist = typeof data.allowlist === 'string' ? data.allowlist.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  settings.denylist = typeof data.denylist === 'string' ? data.denylist.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
});

// Request audio capture when extension is clicked
async function captureAudioFromStream(stream: MediaStream, durationMs: number): Promise<void> {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  const buffer: number[] = [];
  let samplesCollected = 0;
  const targetSamples = (audioCtx.sampleRate * durationMs) / 1000;
  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    buffer.push(...input);
    samplesCollected += input.length;
    if (samplesCollected >= targetSamples) {
      source.disconnect();
      processor.disconnect();
      audioCtx.close();
      const floatBuffer = new Float32Array(buffer);
      chrome.runtime.sendMessage({
        type: 'audioCapture',
        audio: floatBuffer,
        sampleRate: audioCtx.sampleRate,
      });
    }
  };
  source.connect(processor);
  processor.connect(audioCtx.destination);
}

chrome.action.onClicked.addListener(async () => {
  try {
    const stream = await (chrome.tabCapture as any).capture({ audio: true, video: false });
    console.log('Captured audio stream:', stream);
    // Capture 2 seconds of audio and send to runtime
    await captureAudioFromStream(stream, 2000);
  } catch (e) {
    console.error('Audio capture failed:', e);
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'addPrefix') {
    fetch('https://example.com/v1/bucket/' + encodeURIComponent(message.prefix), {
      method: 'POST',
    })
      .then((res) => res.json())
      .then((data) => {
        console.log('Worker added prefix:', data);
        sendResponse({ status: 'added', data });
      })
      .catch((err) => {
        console.error('Error adding prefix:', err);
        sendResponse({ status: 'error', error: err.toString() });
      });
    return true;
  }
  if (message.type === 'bloomFilter') {
    fetch('https://example.com/v1/bucket/' + encodeURIComponent(message.prefix), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: message.prefix }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log('Bloom filter POST response:', data);
        sendResponse({ status: 'bloomAdded', data });
      })
      .catch((err) => {
        console.error('Error posting to Bloom filter:', err);
        sendResponse({ status: 'error', error: err.toString() });
      });
    return true;
  }
  if (message.type === 'extractFeatures') {
    const { features } = message;
    console.log('Background received features:', features);
    sendResponse({ status: 'featuresReceived', featureCount: Object.keys(features).length });
    return true;
  }
  if (message.type === 'audioCapture') {
    const { audio, sampleRate } = message;
    console.log('Background received audio buffer of length', audio.length, 'sampleRate', sampleRate);
    sendResponse({ status: 'received', length: audio.length });
    return true;
  }
  if (message.type === 'allowShow') {
    console.log('User allowed to show slop');
    sendResponse({ status: 'allowed' });
    return true;
  }
  if (message.type === 'checkPrefix') {
    const url = message.url;
    if (settings.denylist.some((u: string) => url.includes(u))) {
      sendResponse({ verdict: 'BLOCK' });
      return true;
    }
    if (settings.allowlist.some((u: string) => url.includes(u))) {
      sendResponse({ verdict: 'ALLOW' });
      return true;
    }
    fetch('https://example.com/v1/bucket/' + encodeURIComponent(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
      .then((res) => res.json())
      .then((data) => {
        const verdict = data.verdict || 'ALLOW';
        sendResponse({ verdict });
      })
      .catch((err) => {
        console.error('Error checking prefix:', err);
        sendResponse({ verdict: 'ALLOW' });
      });
    return true;
  }
  return false;
});
