import { clamp } from "@/lib/utils";

export type MasteryState = {
  skillId: string;
  score: number | null;
  attempts: number;
  correctCount: number;
  recentAccuracy: number;
  confidence: number;
  mistakeFrequency: number;
  retentionScore: number;
  lastPracticedAt: string | null;
  nextReviewAt: string | null;
  intervalDays: number;
  easiness: number;
};

export type AttemptEvidence = {
  skillId: string;
  correct: boolean;
  difficulty: number;
  timeMs: number;
  mistakeCount: number;
  now?: Date;
};

const DEFAULT_INTERVALS = [0, 2, 7, 21, 45];

export function emptyMastery(skillId: string): MasteryState {
  return {
    skillId,
    score: null,
    attempts: 0,
    correctCount: 0,
    recentAccuracy: 0,
    confidence: 0,
    mistakeFrequency: 0,
    retentionScore: 100,
    lastPracticedAt: null,
    nextReviewAt: null,
    intervalDays: 0,
    easiness: 2.5,
  };
}

/**
 * Real mastery update. Recent evidence outweighs old results, jumps are
 * capped, and unused skills slowly decay. Raw attempt rows remain the source
 * of truth; this only produces the next snapshot.
 */
export function applyAttempt(state: MasteryState, ev: AttemptEvidence): MasteryState {
  const now = ev.now ?? new Date();
  const n = state.attempts + 1;
  const prev = state.score ?? (ev.correct ? 35 : 20);
  const stepSize = 0.22 + 0.38 / Math.sqrt(n);

  let delta: number;
  if (ev.correct) {
    const headroom = 1 - prev / 110;
    const hardness = 0.7 + ev.difficulty / 18;
    delta = 10 * hardness * headroom;
    if (ev.mistakeCount > 0) delta *= 0.55;
    if (ev.timeMs > 0 && ev.timeMs < 20_000 && ev.difficulty >= 6) delta *= 1.08;
  } else {
    const easyFail = ev.difficulty <= 4 ? 1.25 : 1;
    delta = -(7 + (10 - ev.difficulty) * 0.7) * easyFail;
    if (ev.mistakeCount >= 2) delta -= 2;
  }
  delta = clamp(delta, -14, 12);

  const score = clamp(prev + delta * stepSize * 4.2, 0, 100);
  const recentAccuracy = state.recentAccuracy * 0.68 + (ev.correct ? 100 : 0) * 0.32;
  const mistakeFrequency =
    state.mistakeFrequency * 0.75 + Math.min(3, ev.mistakeCount) * (100 / 3) * 0.25;
  const confidence = clamp(
    Math.log2(1 + n) * 18 + (recentAccuracy - 50) * 0.25,
    0,
    100,
  );

  const spaced = nextSpaced(state, ev.correct, now);

  return {
    ...state,
    score,
    attempts: n,
    correctCount: state.correctCount + (ev.correct ? 1 : 0),
    recentAccuracy: clamp(recentAccuracy, 0, 100),
    confidence,
    mistakeFrequency: clamp(mistakeFrequency, 0, 100),
    retentionScore: 100,
    lastPracticedAt: now.toISOString(),
    nextReviewAt: spaced.nextReviewAt,
    intervalDays: spaced.intervalDays,
    easiness: spaced.easiness,
  };
}

export function decayMastery(state: MasteryState, now = new Date()): MasteryState {
  if (!state.lastPracticedAt || state.score === null) return state;
  const last = new Date(state.lastPracticedAt);
  const days = (now.getTime() - last.getTime()) / 86_400_000;
  const due = state.intervalDays || 7;
  if (days <= due + 2) {
    return { ...state, retentionScore: clamp(100 - Math.max(0, days - due) * 4, 40, 100) };
  }
  const overdueWeeks = (days - due) / 7;
  const decayed = state.score * Math.pow(0.97, overdueWeeks);
  const retention = clamp(100 - overdueWeeks * 12, 25, 100);
  return {
    ...state,
    score: clamp(decayed, 0, 100),
    retentionScore: retention,
  };
}

function nextSpaced(state: MasteryState, correct: boolean, now: Date) {
  let easiness = state.easiness;
  let interval = state.intervalDays;
  if (correct) {
    easiness = clamp(easiness + 0.08, 1.3, 2.8);
    if (interval <= 0) interval = DEFAULT_INTERVALS[1];
    else if (interval < 7) interval = DEFAULT_INTERVALS[2];
    else interval = Math.round(interval * easiness);
  } else {
    easiness = clamp(easiness - 0.22, 1.3, 2.8);
    interval = 1;
  }
  interval = clamp(interval, 1, 60);
  const next = new Date(now.getTime() + interval * 86_400_000);
  return { intervalDays: interval, easiness, nextReviewAt: next.toISOString() };
}

export type GradeSkillInput = {
  score: number | null;
  relevance: number;
  examFreq: number;
  gradeMin: number;
  gradeMax: number;
  attempts: number;
  category?: string;
};

export type GradeEstimate = {
  estimate: number | null;
  assessedSkills: number;
  confidence: "too-early" | "low" | "medium" | "high";
  coverage: number;
  pathToNine: number;
  higherReady: number;
  algebraReady: number;
  bandLow: number | null;
  bandHigh: number | null;
  whyNotNine: string[];
  strands: Array<{ name: string; assessed: number; total: number; avg: number | null }>;
};

function interp(pct: number, table: Array<[number, number]>): number {
  const p = clamp(pct, 0, 100);
  for (let i = 1; i < table.length; i++) {
    const [x0, y0] = table[i - 1];
    const [x1, y1] = table[i];
    if (p <= x1) {
      const t = (p - x0) / Math.max(1, x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}

/** Conservative Higher-paper map. Not official grade boundaries. */
function percentToGrade(pct: number): number {
  return interp(pct, [
    [0, 1.0],
    [12, 1.5],
    [22, 2.5],
    [30, 3.5],
    [38, 4.2],
    [48, 5.1],
    [58, 6.0],
    [68, 7.0],
    [78, 8.0],
    [88, 8.7],
    [95, 9.0],
    [100, 9.0],
  ]);
}

function weightOf(s: GradeSkillInput): number {
  const higher = s.gradeMax >= 8 ? 1.75 : s.gradeMax >= 7 ? 1.2 : 1;
  const algebra = s.category === "Algebra" ? 1.35 : 1;
  return Math.max(0.4, (s.relevance / 10) * 0.5 + (s.examFreq / 10) * 0.5) * higher * algebra;
}

export function estimateGrade(skills: GradeSkillInput[]): GradeEstimate {
  const empty: GradeEstimate = {
    estimate: null,
    assessedSkills: 0,
    confidence: "too-early",
    coverage: 0,
    pathToNine: 0,
    higherReady: 0,
    algebraReady: 0,
    bandLow: null,
    bandHigh: null,
    whyNotNine: ["Not enough marked work yet — sit a diagnostic or capture a few questions."],
    strands: [],
  };
  if (!skills.length) return empty;

  const UNASSESSED = 18;
  let assessedW = 0;
  let totalW = 0;
  let paper = 0;
  const assessed = skills.filter((s) => s.score !== null && s.attempts > 0);

  for (const s of skills) {
    const w = weightOf(s);
    totalW += w;
    const known = s.score !== null && s.attempts > 0;
    if (known) assessedW += w;
    paper += (known ? (s.score as number) : UNASSESSED) * w;
  }
  const coverage = totalW > 0 ? assessedW / totalW : 0;
  const paperPct = totalW > 0 ? paper / totalW : 0;

  const higher = skills.filter((s) => s.gradeMax >= 8);
  const higherKnown = higher.filter((s) => s.score !== null && s.attempts > 0);
  const higherReady =
    higher.length === 0
      ? 0
      : higher.reduce((a, s) => a + (s.score !== null && s.attempts > 0 ? s.score : UNASSESSED), 0) /
        higher.length;

  const algebra = skills.filter((s) => s.category === "Algebra");
  const algebraKnown = algebra.filter((s) => s.score !== null && s.attempts > 0);
  const algebraReady =
    algebra.length === 0
      ? 0
      : algebra.reduce((a, s) => a + (s.score !== null && s.attempts > 0 ? s.score : UNASSESSED), 0) /
        algebra.length;

  const strandNames = [...new Set(skills.map((s) => s.category ?? "Other"))];
  const strands = strandNames.map((name) => {
    const group = skills.filter((s) => (s.category ?? "Other") === name);
    const done = group.filter((s) => s.score !== null && s.attempts > 0);
    return {
      name,
      assessed: done.length,
      total: group.length,
      avg: done.length ? done.reduce((a, s) => a + (s.score ?? 0), 0) / done.length : null,
    };
  });

  if (assessed.length < 6) {
    const path = Math.round(clamp(coverage * 100 * 0.55 + (assessed.length / 6) * 12, 0, 28));
    return {
      ...empty,
      assessedSkills: assessed.length,
      coverage: Math.round(coverage * 100),
      pathToNine: path,
      higherReady: Math.round(higherReady),
      algebraReady: Math.round(algebraReady),
      strands,
      whyNotNine: [
        `Only ${assessed.length} skill${assessed.length === 1 ? "" : "s"} have evidence. A Grade 9 path needs breadth, not a handful of topics.`,
      ],
    };
  }

  let estimate = percentToGrade(paperPct);
  if (coverage < 0.22) estimate = Math.min(estimate, 4.8);
  else if (coverage < 0.38) estimate = Math.min(estimate, 5.8);
  else if (coverage < 0.55) estimate = Math.min(estimate, 6.7);

  if (higherReady < 48) estimate = Math.min(estimate, 5.4);
  else if (higherReady < 62) estimate = Math.min(estimate, 6.4);
  else if (higherReady < 74) estimate = Math.min(estimate, 7.3);
  else if (higherReady < 82) estimate = Math.min(estimate, 8.1);

  if (algebraReady < 55) estimate = Math.min(estimate, 6.2);
  else if (algebraReady < 72) estimate = Math.min(estimate, 7.4);
  else if (algebraReady < 80) estimate = Math.min(estimate, 8.2);

  if (higherKnown.length < 4) estimate = Math.min(estimate, 6.8);
  if (algebraKnown.length < 3) estimate = Math.min(estimate, 6.5);

  const canBeNine =
    coverage >= 0.5 &&
    higherReady >= 82 &&
    algebraReady >= 78 &&
    assessed.length >= 12 &&
    higherKnown.length >= 6;
  if (!canBeNine) estimate = Math.min(estimate, 8.4);

  estimate = Math.round(clamp(estimate, 1, 9) * 10) / 10;

  const confidence: GradeEstimate["confidence"] =
    coverage >= 0.55 && assessed.length >= 20
      ? "high"
      : coverage >= 0.35 && assessed.length >= 12
        ? "medium"
        : "low";

  const spread = confidence === "high" ? 0.4 : confidence === "medium" ? 0.8 : 1.3;
  const bandLow = Math.round(clamp(estimate - spread, 1, 9) * 10) / 10;
  const bandHigh = Math.round(clamp(estimate + spread, 1, 9) * 10) / 10;

  const whyNotNine: string[] = [];
  if (coverage < 0.5) {
    whyNotNine.push(
      `Coverage is ${Math.round(coverage * 100)}% of the exam-weighted skill map. Grade 9 needs evidence across the full higher paper, not just what you’ve practised.`,
    );
  }
  if (higherReady < 82) {
    whyNotNine.push(
      `Higher-tier skills sit at ${Math.round(higherReady)}% (unseen topics count as weak). Grade 9 needs these reliably over 80%.`,
    );
  }
  if (algebraReady < 78) {
    whyNotNine.push(
      `Algebra is at ${Math.round(algebraReady)}%. It is the usual Grade 9 bottleneck — method, rearrangement and proof, not just answers.`,
    );
  }
  const weakStrand = strands
    .filter((s) => s.avg !== null && s.avg < 60)
    .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))[0];
  if (weakStrand) {
    whyNotNine.push(`${weakStrand.name} is dragging the estimate (${Math.round(weakStrand.avg ?? 0)}% on assessed skills).`);
  }
  if (whyNotNine.length === 0 && estimate >= 8.5) {
    whyNotNine.push("You are close. A Grade 9 still needs consistent higher-tier accuracy under timed conditions.");
  }

  const pathToNine = Math.round(
    clamp(
      coverage * 38 +
        (higherReady / 100) * 36 +
        (algebraReady / 100) * 16 +
        (estimate / 9) * 10,
      0,
      99,
    ),
  );

  return {
    estimate,
    assessedSkills: assessed.length,
    confidence,
    coverage: Math.round(coverage * 100),
    pathToNine,
    higherReady: Math.round(higherReady),
    algebraReady: Math.round(algebraReady),
    bandLow,
    bandHigh,
    whyNotNine,
    strands,
  };
}
