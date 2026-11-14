// Pure state-machine pieces of the content script (plan §7.2), kept separate so
// they can be unit-tested in Node — the content script itself is a classic
// script with no exports and needs a browser to run.

export type Phase = 'IDLE' | 'OBSERVED' | 'CACHE_CHECK' | 'BLOOM' | 'SCORING' | 'VERDICT' | 'UI';

/** Plan order: IDLE → OBSERVED → CACHE_CHECK → [BLOOM → EDGE_CONFIRM] → SCORING → VERDICT → UI. */
export type AnalyseEvent =
  | 'video-observed'
  | 'cache-check'
  | 'bloom-check'
  | 'scoring-start'
  | 'scoring-done'
  | 'ui-shown'
  | 'dismissed';

export interface PhaseContext {
  /** No edge origin → the BLOOM/EDGE_CONFIRM leg is skipped entirely. */
  edgeConfigured: boolean;
}

/**
 * Advance the analysis phase. The event ordering is the plan's; an event that
 * would move backwards is ignored, which is what keeps a second navigation from
 * clobbering an in-flight analysis.
 */
export function nextPhase(current: Phase, event: AnalyseEvent, ctx: PhaseContext = { edgeConfigured: false }): Phase {
  switch (event) {
    case 'video-observed':
      // A new video arriving mid-analysis must not be swallowed.
      return current === 'SCORING' ? 'SCORING' : 'OBSERVED';
    case 'cache-check':
      return current === 'SCORING' || current === 'VERDICT' || current === 'UI' ? current : 'CACHE_CHECK';
    case 'bloom-check':
      return ctx.edgeConfigured ? 'BLOOM' : current;
    case 'scoring-start':
      return 'SCORING';
    case 'scoring-done':
      return 'VERDICT';
    case 'ui-shown':
      return 'UI';
    case 'dismissed':
      return 'OBSERVED';
  }
}

// ---- active video -------------------------------------------------------------

/** Structural subset of HTMLVideoElement so this runs (and is testable) headless. */
export interface VideoLike {
  readyState: number;
  paused: boolean;
  ended: boolean;
  currentTime: number;
  width: number;
  height: number;
  /** index into the original list, kept so callers can map back. */
  index?: number;
}

/**
 * Pick the video actually playing (plan §7.2: never analyse a preloaded
 * neighbour from the Shorts feed). Playing beats merely-loaded; among equals the
 * largest visible frame wins.
 */
export function pickActiveVideo(videos: VideoLike[]): number {
  const usable = videos
    .map((v, index) => ({ ...v, index }))
    .filter((v) => v.readyState >= 2 && v.width > 0 && v.height > 0);
  if (!usable.length) return -1;
  const playing = usable.filter((v) => !v.paused && !v.ended);
  const pool = playing.length ? playing : usable;
  return pool.reduce((best, v) => (v.width * v.height > best.width * best.height ? v : best), pool[0]).index!;
}

// ---- retroactive verdicts -----------------------------------------------------

export interface StoredVerdict {
  verdict: string;
  srs: number | undefined;
  reasons: { label: string; value: string }[];
}

/**
 * Verdicts seen in this page session, so returning to an already-scored video
 * (swiping back in the Shorts feed) re-shows the advisory immediately instead of
 * re-running a 6 s analysis (plan §7.2, "applied retroactively").
 */
const seen = new Map<string, StoredVerdict>();

export function rememberVerdict(videoId: string, v: StoredVerdict): void {
  seen.set(videoId, v);
}

export function recallVerdict(videoId: string): StoredVerdict | null {
  return seen.get(videoId) ?? null;
}

export function forgetVerdicts(): void {
  seen.clear();
}
