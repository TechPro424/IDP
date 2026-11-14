// Content script: detect the video, sample audio/frames/captions locally,
// score locally (via the background), and show an advisory overlay.
// Never leaves the page except a 5-char prefix when an edge origin is set.
import { extractAudioFeatures } from '../features/src/audio.js';
import { VisualAnalyzer } from '../features/src/visual.js';
import { extractTextFeatures } from '../features/src/text.js';
import type { FeatureResult } from '../features/src/index.js';
import { videoIdOf } from '../features/src/hash.js';
import {
  nextPhase,
  pickActiveVideo,
  recallVerdict,
  rememberVerdict,
  type Phase,
} from './state.js';
import { loadSettings, saveSettings, type Settings } from './settings.js';

declare const chrome: any;

const OVERLAY_ID = 'slop-filter-overlay';
const ANALYSIS_MS = 6000;
const FRAME_RATE = 6;
/** Below this, the text is a title with nothing behind it — treat as missing. */
const MIN_TEXT_CHARS = 200;
const FRAME_MS = 1000 / FRAME_RATE;


let settings: Settings;
let phase: Phase = 'IDLE';
let currentVideoId = '';
let analyzing = false;
let adPlaying = false;
let wasEnabled = false;

/**
 * Phase transitions go through the reducer in state.ts so the plan's ordering
 * (IDLE → OBSERVED → … → VERDICT → UI) is enforced in one place. The CACHE_CHECK
 * and BLOOM legs live inside the background worker, which consults the local
 * verdict cache and then the edge before deciding.
 */
function apply(event: Parameters<typeof nextPhase>[1]): void {
  phase = nextPhase(phase, event, { edgeConfigured: !!settings?.edgeOrigin });
}

function send(message: any): Promise<any> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (r: any) => {
        if (chrome.runtime.lastError) {
          console.warn('[slop-filter] background unavailable:', chrome.runtime.lastError.message);
          resolve(undefined);
          return;
        }
        resolve(r);
      });
    } catch {
      resolve(undefined);
    }
  });
}

// ---- overlay -----------------------------------------------------------------

// Cached because the shadow root is closed: `element.shadowRoot` is always null,
// so re-querying the document would stack a second host on top of the first.
let overlayRoot: ShadowRoot | null = null;
let noticeMode = false;

function overlay(): ShadowRoot | null {
  if (overlayRoot?.host.isConnected) return overlayRoot;
  const host = document.createElement('div');
  host.id = OVERLAY_ID;
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .card {
        position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: 300px;
        background: #1f2430; color: #f2f4f8; border: 1px solid #3a4256; border-radius: 10px;
        padding: 14px; font: 13px/1.45 system-ui, sans-serif; box-shadow: 0 8px 28px rgba(0,0,0,.45);
      }
      .dim {
        position: fixed; inset: 0; z-index: 2147483646; pointer-events: none;
        background: rgba(6, 8, 12, .28); opacity: 0; transition: opacity .25s ease;
      }
      .dim.on { opacity: 1; }
      .dim.no-motion { transition: none; opacity: 1; }
      .card.review { border-color: #8a6d1f; }
      .card.block { border-color: #8f3b3b; }
      h2 { margin: 0 0 4px; font-size: 15px; }
      .sub { color: #a9b2c3; margin: 0 0 10px; font-size: 12px; }
      details { margin-bottom: 10px; }
      summary { cursor: pointer; color: #cfd6e4; }
      ul { margin: 6px 0 0; padding-left: 16px; }
      li { margin: 2px 0; }
      .row { display: flex; gap: 6px; flex-wrap: wrap; }
      button {
        flex: 1; min-width: 84px; padding: 6px 8px; border-radius: 6px; cursor: pointer;
        border: 1px solid #4a5468; background: #2b3242; color: #f2f4f8; font: inherit;
      }
      button.primary { background: #3a6ea5; border-color: #3a6ea5; }
      @media (prefers-reduced-motion: reduce) { .card { transition: none; } }
      .card.no-motion { transition: none; }
      @media (prefers-contrast: more) { .card { border-width: 2px; } #fine { opacity: 1; } }
      @media (forced-colors: active) {
        .card { background: Canvas; color: CanvasText; border: 1px solid CanvasText; }
        button { background: ButtonFace; color: ButtonText; border: 1px solid ButtonText; }
      }
    </style>
    <div class="dim" aria-hidden="true"></div>
    <div class="card" role="dialog" aria-live="polite" aria-label="Slop Filter advisory">
      <h2 id="title"></h2>
      <p class="sub" id="sub"></p>
      <details><summary>Why am I seeing this?</summary><ul id="reasons"></ul></details>
      <div class="row">
        <button class="primary" id="show" aria-label="Show anyway">Show anyway</button>
        <button id="fine" aria-label="This looks fine">This looks fine</button>
        <button id="slop" aria-label="It is slop">It is slop</button>
      </div>
    </div>`;
  root.querySelector('#show')!.addEventListener('click', () => {
    const notice = noticeMode;
    dismiss();
    if (!notice) recordFeedback('show_anyway');
  });
  root.querySelector('#fine')!.addEventListener('click', () => {
    dismiss();
    recordFeedback('false_positive');
  });
  // Local-only, never uploaded (plan §7.4): the user agreeing is the one signal
  // we cannot compute ourselves.
  root.querySelector('#slop')!.addEventListener('click', () => {
    dismiss();
    recordFeedback('confirmed_slop');
  });
  document.documentElement.appendChild(host);
  overlayRoot = root;
  return root;
}

/**
 * Dim the page behind the advisory (plan §7.4). Pointer-events stay off, so
 * playback controls keep working — this is a nudge, not a blocker.
 */
function setDim(root: ShadowRoot, on: boolean): void {
  const dim = root.querySelector('.dim') as HTMLElement | null;
  if (!dim) return;
  if (settings.reduceMotion) dim.classList.add('no-motion');
  dim.classList.toggle('on', on);
}

function dismiss(): void {
  document.getElementById(OVERLAY_ID)?.remove();
  overlayRoot = null;
  noticeMode = false;
  apply('dismissed');
}

function showOverlay(verdict: string, srs: number | undefined, reasons: { label: string; value: string }[]): void {
  if (phase === 'UI') return;
  const root = overlay();
  if (!root) return;
  noticeMode = false;
  const card = root.querySelector('.card') as HTMLElement;
  card.classList.toggle('block', verdict === 'BLOCK');
  card.classList.toggle('review', verdict !== 'BLOCK');
  if (settings.reduceMotion) card.classList.add('no-motion');
  (root.querySelector('details') as HTMLElement).hidden = false;
  (root.querySelector('#fine') as HTMLElement).hidden = false;
  (root.querySelector('#slop') as HTMLElement).hidden = false;
  (root.querySelector('#show') as HTMLElement).textContent = 'Show anyway';
  (root.querySelector('#title') as HTMLElement).textContent =
    verdict === 'BLOCK' ? 'Likely synthetic narration' : 'Possibly synthetic narration';
  (root.querySelector('#sub') as HTMLElement).textContent =
    srs === undefined
      ? 'Advisory only — not enough signal to be confident. Your call.'
      : `Advisory only (confidence ${Math.round(srs * 100)}%). Not a takedown — your call.`;
  const list = root.querySelector('#reasons') as HTMLElement;
  list.innerHTML = '';
  for (const r of reasons) {
    const li = document.createElement('li');
    li.textContent = `${r.label}: ${r.value}`;
    list.appendChild(li);
  }
  // The shadow root is closed, so the host's dataset is the only externally
  // observable state (used by the e2e fixtures).
  setDim(root, true);
  const host = root.host as HTMLElement;
  host.dataset.kind = 'advisory';
  host.dataset.verdict = verdict;
  apply('ui-shown');
}

/** Failure surface: without this a broken capture looks identical to "nothing to report". */
function showNotice(message: string): void {
  const root = overlay();
  if (!root) return;
  noticeMode = true;
  const card = root.querySelector('.card') as HTMLElement;
  card.classList.remove('block', 'review');
  if (settings.reduceMotion) card.classList.add('no-motion');
  (root.querySelector('#title') as HTMLElement).textContent = 'Analysis unavailable';
  (root.querySelector('#sub') as HTMLElement).textContent = message;
  (root.querySelector('details') as HTMLElement).hidden = true;
  (root.querySelector('#fine') as HTMLElement).hidden = true;
  (root.querySelector('#slop') as HTMLElement).hidden = true;
  (root.querySelector('#show') as HTMLElement).textContent = 'Dismiss';
  setDim(root, true);
  const host = root.host as HTMLElement;
  host.dataset.kind = 'notice';
  delete host.dataset.verdict;
  apply('ui-shown');
}

function recordFeedback(kind: string): void {
  chrome.storage.local.get(['feedback'], (data: any) => {
    const feedback = Array.isArray(data.feedback) ? data.feedback : [];
    feedback.push({ kind, videoId: currentVideoId, ts: Date.now() });
    chrome.storage.local.set({ feedback });
  });
}

// ---- capture -----------------------------------------------------------------

const sourceCache = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
let sharedCtx: AudioContext | null = null;

function audioContext(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext();
  return sharedCtx;
}

type AudioCapture = { ok: true; samples: Float32Array; sampleRate: number } | { ok: false; reason: string };

/** Sample the tab's audio through an AnalyserNode (no ScriptProcessor). */
async function captureAudio(video: HTMLMediaElement): Promise<AudioCapture> {
  if (video.muted || video.volume === 0) {
    // A muted element feeds the source node silence, so every audio feature would
    // read as "no speech" rather than "could not listen".
    return { ok: false, reason: 'The video is muted — unmute it and analyze again.' };
  }
  let source: MediaElementAudioSourceNode | undefined;
  let analyser: AnalyserNode | undefined;
  try {
    const ctx = audioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') {
      return { ok: false, reason: 'The browser blocked audio until you interact with the page.' };
    }
    source = sourceCache.get(video);
    if (!source) {
      source = ctx.createMediaElementSource(video);
      sourceCache.set(video, source);
      // Once the element is routed through WebAudio its sound only reaches the
      // speakers through the graph, so a suspended context would mute the video
      // silently. Resume on every play.
      video.addEventListener('play', () => void audioContext().resume().catch(() => {}));
    }
    // Route through the analyser for the capture window. An AnalyserNode on a side
    // branch that never reaches the destination is not guaranteed to be pulled.
    analyser = ctx.createAnalyser();
    const an = analyser;
    an.fftSize = 2048;
    source.disconnect();
    source.connect(an);
    an.connect(ctx.destination);
    const buf = new Float32Array(an.fftSize);
    const chunks: Float32Array[] = [];
    const start = performance.now();
    while (performance.now() - start < ANALYSIS_MS && !adPlaying) {
      an.getFloatTimeDomainData(buf);
      chunks.push(new Float32Array(buf));
      await new Promise((r) => setTimeout(r, 40));
    }
    if (!chunks.length) return { ok: false, reason: 'No audio was captured from this video.' };
    const out = new Float32Array(chunks.length * an.fftSize);
    chunks.forEach((c, i) => out.set(c, i * an.fftSize));
    return { ok: true, samples: out, sampleRate: ctx.sampleRate };
  } catch (err) {
    return { ok: false, reason: `Audio capture failed: ${(err as Error).message}` };
  } finally {
    // Restore the direct path or the video goes permanently silent.
    try {
      if (source) {
        source.disconnect();
        analyser?.disconnect();
        source.connect(audioContext().destination);
      }
    } catch {
      /* element removed mid-capture */
    }
  }
}

/** YouTube keeps several <video> elements around; pick the one actually playing. */
function activeVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll('video'));
  const index = pickActiveVideo(
    videos.map((v) => {
      const rect = v.getBoundingClientRect();
      return {
        readyState: v.readyState,
        paused: v.paused,
        ended: v.ended,
        currentTime: v.currentTime,
        width: rect.width,
        height: rect.height,
      };
    }),
  );
  return index < 0 ? null : videos[index];
}

async function sampleFrames(video: HTMLVideoElement): Promise<ImageData[]> {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 36;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const frames: ImageData[] = [];
  if (!ctx) return frames;
  const start = performance.now();
  // Yield between frames: a tight loop freezes the page *and* samples at an
  // unbounded rate, which inflates cutsPerMinute.
  while (performance.now() - start < ANALYSIS_MS && !adPlaying) {
    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
    await new Promise((r) => setTimeout(r, FRAME_MS));
  }
  return frames;
}

function collectCaptions(): string {
  return Array.from(document.querySelectorAll('.ytp-caption-segment, .caption-window'))
    .map((el) => (el as HTMLElement).innerText)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Visible title (plan §7.1: text features read the DOM title *and* captions). */
function pageTitle(): string {
  const el = document.querySelector('h1.ytd-watch-metadata, #title h1, h1.title') as HTMLElement | null;
  return (el?.innerText ?? document.title.replace(/\s*-\s*YouTube\s*$/, '')).replace(/\s+/g, ' ').trim();
}

async function analyzeNow(): Promise<void> {
  if (analyzing || !currentVideoId) return;
  if (adPlaying) return;
  analyzing = true;
  let analysisId = currentVideoId;
  try {
    const video = activeVideo();
    if (!video) return;
    // Videos can be 6 s away from the id we started on; scoring B's features
    // under C's id would show (and cache) the wrong verdict.
    analysisId = currentVideoId;
    apply('scoring-start');
    const captionText = [pageTitle(), collectCaptions()].filter(Boolean).join('\n');    // Audio and frames are independent 6 s windows; run them concurrently.
    const [audio, frames] = await Promise.all([captureAudio(video), sampleFrames(video)]);

    let features: FeatureResult = {};
    if (audio.ok) {
      features.audio = await extractAudioFeatures({ data: audio.samples, sampleRate: audio.sampleRate });
    }
    if (frames.length) {
      const analyzer = new VisualAnalyzer(FRAME_RATE);
      for (const f of frames) analyzer.analyzeFrame(f as any);
      features.visual = analyzer.getResult();
    }
    if (captionText.length >= MIN_TEXT_CHARS) {
      features.text = await extractTextFeatures(captionText);
    }

    if (analysisId !== currentVideoId) return;

    if (!features.audio && !features.visual && !features.text) {
      showNotice(audio.ok ? 'There was not enough signal to analyze this video.' : audio.reason);
      return;
    }

    const reply = await send({ type: 'scoreVideo', videoId: analysisId, url: location.href, features });
    if (!reply) {
      showNotice('The analyzer did not respond. Reload the page and try again.');
      console.warn('[slop-filter] no verdict; see the extension service worker console');
      return;
    }
    apply('scoring-done');
    rememberVerdict(analysisId, {
      verdict: reply.verdict,
      srs: reply.SRS,
      reasons: reply.reasons ?? [],
    });
    if (reply.verdict === 'BLOCK' || reply.verdict === 'REVIEW') {
      showOverlay(reply.verdict, reply.SRS, reply.reasons ?? []);
    } else {
      apply('dismissed');
    }
    if (settings.annotation && reply.verdict === 'BLOCK') promptAnnotation();
  } catch (err) {
    console.warn('[slop-filter] analysis failed', err);
    showNotice(`Analysis failed: ${(err as Error).message}`);
  } finally {
    analyzing = false;
    // A navigation during the capture window leaves the new video unscored;
    // onNavigate's attempt bailed on the `analyzing` guard.
    if (started && currentVideoId !== analysisId) setTimeout(() => void analyzeNow(), 0);
  }
}

// ---- annotation ---------------------------------------------------------------

function promptAnnotation(): void {
  const note = window.prompt('Annotation (optional): what did you notice?');
  if (note == null) return;
  chrome.storage.local.get(['annotations'], (data: any) => {
    const annotations = Array.isArray(data.annotations) ? data.annotations : [];
    annotations.push({ videoId: currentVideoId, note, ts: Date.now(), rubric: {} });
    chrome.storage.local.set({ annotations });
  });
}

// ---- lifecycle ----------------------------------------------------------------

let adObserver: MutationObserver | null = null;

function observeAds(): void {
  const player = document.querySelector('#movie_player, .html5-video-player');
  if (!player) return;
  const update = () => (adPlaying = player.classList.contains('ad-showing'));
  update();
  // YouTube reuses #movie_player across SPA navigations, so a fresh observer per
  // navigation would pile up on the same node.
  adObserver?.disconnect();
  adObserver = new MutationObserver(update);
  adObserver.observe(player, { attributes: true, attributeFilter: ['class'] });
}

function onNavigate(): void {
  const id = videoIdOf(location.href);
  if (!id || id === currentVideoId) return;
  currentVideoId = id;
  dismiss();
  observeAds();
  if (!settings.enabled) return;
  // Returning to a video already scored in this session (Short swipe-back) shows
  // the advisory again immediately instead of re-running the analysis.
  const stored = recallVerdict(id);
  if (stored && stored.verdict !== 'ALLOW') {
    showOverlay(stored.verdict, stored.srs, stored.reasons);
    return;
  }
  setTimeout(() => void analyzeNow(), 1500);
}

let started = false;

function init(): void {
  if (started) return;
  if (location.hostname !== 'www.youtube.com') return;
  started = true;
  document.addEventListener('yt-navigate-finish', onNavigate, { passive: true });
  chrome.runtime.onMessage.addListener((message: any) => {
    if (message?.type === 'analyzeNow') void analyzeNow();
    if (message?.type === 'dismiss') dismiss();
  });
  setInterval(() => {
    const id = videoIdOf(location.href);
    if (id && id !== currentVideoId) onNavigate();
  }, 2000);
  onNavigate();
}

loadSettings().then((s) => {
  settings = s;
  if (settings.enabled && settings.consent) {
    init();
    wasEnabled = true;
  }
  chrome.storage.onChanged.addListener((changes: any, area: string) => {
    if (area !== 'local') return;
    settings = { ...settings, ...Object.fromEntries(Object.entries(changes).map(([k, v]: any) => [k, v.newValue])) };
    const on = settings.enabled && settings.consent;
    if (on) init();
    // Enabling while already on a watch page should analyze now, not on the next navigation.
    if (on && !wasEnabled) {
      wasEnabled = true;
      if (currentVideoId) void analyzeNow();
    }
    if (!on) wasEnabled = false;
  });
});

