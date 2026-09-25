import type { MasteryState } from "@/lib/engines/mastery";
import type { SkillDef } from "@/lib/curriculum/types";

export type PriorityInput = {
  skill: SkillDef;
  mastery: MasteryState;
  recentMistakes: number;
  dependents: number;
  targetGrade: number;
};

export type RankedSkill = {
  skillId: string;
  name: string;
  category: string;
  mastery: number | null;
  priority: number;
  reason: string;
  whyItMatters: string;
  estimatedMinutes: number;
};

/**
 * What should this student practise next?
 *
 * Weak percentage is only one factor. A moderately weak Grade 9 blocker can
 * outrank a very weak low-importance skill.
 */
export function rankPriorities(items: PriorityInput[], now = new Date()): RankedSkill[] {
  return items
    .map((item) => scoreItem(item, now))
    .sort((a, b) => b.priority - a.priority);
}

function scoreItem(item: PriorityInput, now: Date): RankedSkill {
  const { skill, mastery, recentMistakes, dependents, targetGrade } = item;
  const score = mastery.score;
  const weakness = score === null ? 72 : Math.max(0, 100 - score);

  const inTargetBand =
    targetGrade >= skill.gradeMin - 1 && skill.gradeMax >= targetGrade - 2;
  const targetRelevance = inTargetBand ? 1 : skill.gradeMax >= targetGrade ? 0.55 : 0.28;

  const importance = skill.relevance / 10;
  const freq = skill.examFreq / 10;
  const mistakeBoost = 1 + Math.min(4, recentMistakes) * 0.22;

  let improvement = 1;
  if (score !== null) {
    if (score >= 40 && score <= 78) improvement = 1.35;
    else if (score > 88) improvement = 0.45;
    else if (score < 25 && mastery.attempts > 6) improvement = 0.7;
  }

  const prereqBlock = 1 + Math.min(5, dependents) * 0.18;

  let retentionNeed = 1;
  if (mastery.nextReviewAt) {
    const due = new Date(mastery.nextReviewAt);
    if (due.getTime() <= now.getTime()) retentionNeed = 1.4;
    else if (due.getTime() - now.getTime() < 2 * 86_400_000) retentionNeed = 1.15;
  }
  if (mastery.retentionScore < 60) retentionNeed = Math.max(retentionNeed, 1.35);

  const priority =
    weakness *
    importance *
    targetRelevance *
    mistakeBoost *
    improvement *
    prereqBlock *
    retentionNeed *
    (0.7 + freq * 0.3);

  const reasons: string[] = [];
  if (score === null) reasons.push("not yet assessed");
  else if (score < 55) reasons.push("clear weakness");
  else if (score < 70) reasons.push("not yet secure");
  if (recentMistakes >= 2) reasons.push("repeated mistakes");
  if (dependents >= 2) reasons.push("blocks later Grade 8/9 topics");
  if (skill.gradeMax >= 8 && (score === null || score < 75)) reasons.push("Grade 9 requirement");
  if (mastery.retentionScore < 60) reasons.push("slipping from memory");
  if (!reasons.length) reasons.push("high exam value");

  const minutes =
    score === null ? 15 : score < 50 ? 18 : score < 70 ? 12 : 8;

  return {
    skillId: skill.id,
    name: skill.name,
    category: skill.category,
    mastery: score,
    priority,
    reason: reasons[0],
    whyItMatters: buildWhy(skill, score, recentMistakes, dependents),
    estimatedMinutes: minutes,
  };
}

function buildWhy(
  skill: SkillDef,
  score: number | null,
  mistakes: number,
  dependents: number,
): string {
  const bits: string[] = [];
  if (score === null) {
    bits.push(`We have no evidence yet for ${skill.name.toLowerCase()}.`);
  } else {
    bits.push(`Current mastery is ${Math.round(score)}%.`);
  }
  if (skill.gradeMax >= 8) {
    bits.push("This skill sits on the Grade 8/9 paper.");
  }
  if (dependents >= 2) {
    bits.push("It is a prerequisite for several later topics.");
  }
  if (mistakes >= 2) {
    bits.push(`The same kind of error has shown up ${mistakes} times recently.`);
  }
  if (skill.examFreq >= 8) {
    bits.push("It appears frequently on GCSE papers.");
  }
  return bits.join(" ");
}

export function topWeaknesses(ranked: RankedSkill[], n = 3): RankedSkill[] {
  return ranked
    .filter((r) => r.mastery !== null)
    .sort((a, b) => (a.mastery ?? 100) - (b.mastery ?? 100))
    .slice(0, n);
}

export function recentImprovements(
  before: Array<{ skillId: string; name: string; score: number | null }>,
  after: Array<{ skillId: string; name: string; score: number | null }>,
): Array<{ name: string; delta: number }> {
  const map = new Map(after.map((s) => [s.skillId, s]));
  return before
    .map((b) => {
      const a = map.get(b.skillId);
      if (!a || a.score === null || b.score === null) return null;
      return { name: a.name, delta: a.score - b.score };
    })
    .filter((x): x is { name: string; delta: number } => x !== null && x.delta >= 1.5)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 4);
}
