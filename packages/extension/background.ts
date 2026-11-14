// Background service worker: local scoring, optional prefix-only edge
// corroboration, local cache, allow/deny lists. No full URL ever leaves the
// device (CHECKLIST.md §2.2).
import { decide, explain, Verdict, type SubScores, type Thresholds } from '../scoring/src/index.js';
import { deriveSubScores } from '../scoring/src/proxies.js';
import { ML_MODEL_VERSION } from '../scoring/src/model.js';
import { loadSettings, saveSettings, DEFAULT_SETTINGS, type Settings } from './settings.js';
import { getCachedVerdict, putCachedVerdict } from './cache.js';
import { lookupUrl } from './edge.js';

declare const chrome: any;

interface VerdictReply {
  verdict: Verdict;
  srs?: number;
  H?: number;
  reasons: { label: string; value: string }[];
  cached?: boolean;
  knownSlop?: boolean;
}

let settings: Settings = DEFAULT_SETTINGS;

loadSettings().then((s) => {
  settings = s;
});
chrome.storage.onChanged.addListener((changes: any, area: string) => {
  if (area === 'local') settings = { ...settings, ...Object.fromEntries(Object.entries(changes).map(([k, v]: any) => [k, v.newValue])) };
});

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function thresholdPair(): Thresholds {
  return { tauS: settings.tauS, tauH: settings.tauH, grayBand: settings.grayBand };
}

function applyLists(url: string): Verdict | null {
  const host = hostOf(url);
  if (settings.denylist.some((d) => host.endsWith(d))) return Verdict.BLOCK;
  if (settings.allowlist.some((d) => host.endsWith(d))) return Verdict.ALLOW;
  return null;
}

async function scoreVideo(videoId: string, url: string, features: Parameters<typeof deriveSubScores>[0]): Promise<VerdictReply> {
  const forced = applyLists(url);
  if (forced !== null) {
    return { verdict: forced, reasons: [{ label: 'List rule', value: forced === Verdict.BLOCK ? 'denylisted' : 'allowlisted' }] };
  }

  const cached = await getCachedVerdict(videoId, ML_MODEL_VERSION);
  if (cached) {
    return { verdict: cached.verdict as Verdict, srs: cached.srs, H: cached.H, reasons: cached.reasons, cached: true };
  }

  // Plan §7.2 order: CACHE_CHECK → [BLOOM_CHECK → EDGE_CONFIRM] → SCORING.
  // The edge is consulted first so a seeded verdict is known before (and can
  // outrank) the local score; the local score still runs, because only it can
  // produce BLOCK.
  let knownSlop = false;
  let edgeReasons: { label: string; value: string }[] = [];
  if (settings.edgeOrigin) {
    const lookup = await lookupUrl(settings.edgeOrigin, url);
    if (lookup?.known) {
      knownSlop = true;
      edgeReasons = [
        {
          label: lookup.verdict === 1 ? 'Seeded as slop' : 'Seeded for review',
          value: 'edge verdict set',
        },
      ];
    }
  }

  const sub: SubScores = deriveSubScores(features);
  const result = decide(sub, thresholdPair(), settings.missingModalityPolicy);
  const reasons = explain(sub);

  // Guardrail §7.3: the edge may only raise the verdict, never lower it.
  if (knownSlop && result.verdict === Verdict.ALLOW) {
    result.verdict = Verdict.REVIEW;
  }
  if (knownSlop) reasons.unshift(...edgeReasons);

  const reply: VerdictReply = { verdict: result.verdict, srs: result.SRS, H: result.H, reasons, knownSlop };
  if (result.SRS !== undefined) {
    putCachedVerdict({
      videoId,
      verdict: result.verdict,
      srs: result.SRS,
      H: result.H,
      reasons,
      modelVersion: ML_MODEL_VERSION,
      ts: Date.now(),
    });
  }
  return reply;
}

chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: (r: any) => void) => {
  switch (message?.type) {
    case 'enableFilter':
      settings = { ...settings, enabled: !!message.enabled };
      saveSettings({ enabled: !!message.enabled });
      sendResponse({ ok: true });
      return false;

    case 'getSettings':
      sendResponse(settings);
      return false;

    case 'scoreVideo':
      scoreVideo(message.videoId, message.url, message.features).then(sendResponse, (err) =>
        sendResponse({ verdict: Verdict.REVIEW, reasons: [{ label: 'Error', value: String(err) }] }),
      );
      return true; // async response

    case 'startAnalysis': {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        const tab = tabs?.[0];
        if (!tab?.id) {
          sendResponse({ error: 'no active tab' });
          return;
        }
        chrome.tabs.sendMessage(tab.id, { type: 'analyzeNow' }, () => void chrome.runtime.lastError);
        sendResponse({ ok: true });
      });
      return true;
    }

    default:
      sendResponse({ ok: false, error: 'unknown message' });
      return false;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  loadSettings().then((s) => {
    settings = s;
  });
});
