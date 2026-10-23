import { extractFeatures, AudioInput } from '../features/src/index';

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
    // Send audio buffer to background for further processing
    chrome.runtime.sendMessage({ type: 'audioCapture', audio: data, sampleRate: audioCtx.sampleRate });
  }, captureDurationSec * 1000);
}

// Start capture when the page is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  startCapture();
} else {
  document.addEventListener('DOMContentLoaded', startCapture);
}

