import {
  decide, explain, Verdict, DEFAULT_THRESHOLDS,
  MISSING_MODALITY_POLICY, makeLogisticFusion, fuseAnd,
} from '../src/index.js';

(() => {
  // Clear block.
  if (decide({ S: 0.9, Hatt: 0.9, Hsub: 0.9 }).verdict !== Verdict.BLOCK) throw new Error('expected BLOCK');
  // Clear allow.
  if (decide({ S: 0.1, Hatt: 0.1, Hsub: 0.1 }).verdict !== Verdict.ALLOW) throw new Error('expected ALLOW');

  // Gray band near either threshold → REVIEW, never BLOCK.
  const band = decide({ S: 0.62, Hatt: 0.95, Hsub: 0.95 });
  if (band.verdict !== Verdict.REVIEW) throw new Error(`expected REVIEW in gray band, got ${band.verdict}`);

  // Missing S honours policy.
  if (decide({ Hatt: 0.9, Hsub: 0.9 }, DEFAULT_THRESHOLDS, MISSING_MODALITY_POLICY.TREAT_SAFE).verdict !== Verdict.ALLOW) {
    throw new Error('TREAT_SAFE should ALLOW');
  }
  if (decide({ Hatt: 0.9, Hsub: 0.9 }, DEFAULT_THRESHOLDS, MISSING_MODALITY_POLICY.TREAT_RISKY).verdict !== Verdict.REVIEW) {
    throw new Error('TREAT_RISKY should REVIEW');
  }
  // Missing H → REVIEW regardless.
  if (decide({ S: 0.9 }).verdict !== Verdict.REVIEW) throw new Error('missing H should REVIEW');

  // Logistic fusion is a real function of [S, H, S*H].
  const logistic = makeLogisticFusion();
  const lo = logistic({ S: 0.2, Hatt: 0.2, Hsub: 0.2 })!;
  const hi = logistic({ S: 0.8, Hatt: 0.8, Hsub: 0.8 })!;
  if (!(hi > lo)) throw new Error('logistic fusion not monotonic');
  if (!(fuseAnd({ S: 0.3, Hatt: 0.7, Hsub: 0.7 }) === 0.3)) throw new Error('fuseAnd should be min(S,H)');

  const rows = explain({ S: 0.9, Hatt: 0.9, Hsub: 0.9 });
  if (rows.length !== 3) throw new Error('explain should return 3 rows');

  console.log('Scoring test passed.');
})();
