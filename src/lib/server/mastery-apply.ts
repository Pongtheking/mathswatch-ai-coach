import { SKILLS, SKILL_BY_ID } from "@/lib/curriculum/data";
import { applyAttempt, decayMastery, emptyMastery, type MasteryState } from "@/lib/engines/mastery";
import { rankPriorities, type RankedSkill } from "@/lib/engines/priority";
import { parseJson } from "@/lib/utils";
import type { Sql } from "@/lib/db";

type MasteryRow = {
  skill_id: string;
  score: number | null;
  attempts: number;
  correct_count: number;
  recent_accuracy: number;
  confidence: number;
  mistake_frequency: number;
  retention_score: number;
  last_practiced_at: string | null;
  next_review_at: string | null;
  interval_days: number;
  easiness: number;
};

export function rowToMastery(r: MasteryRow): MasteryState {
  return {
    skillId: r.skill_id,
    score: r.score,
    attempts: r.attempts,
    correctCount: r.correct_count,
    recentAccuracy: r.recent_accuracy,
    confidence: r.confidence,
    mistakeFrequency: r.mistake_frequency,
    retentionScore: r.retention_score,
    lastPracticedAt: r.last_practiced_at,
    nextReviewAt: r.next_review_at,
    intervalDays: r.interval_days,
    easiness: r.easiness,
  };
}

export async function loadMastery(sql: Sql, userId: string): Promise<MasteryState[]> {
  const rows = await sql<MasteryRow>`select * from mastery_scores where user_id = ${userId}`;
  return rows.map((r) => decayMastery(rowToMastery(r)));
}

export async function saveMastery(sql: Sql, userId: string, m: MasteryState) {
  await sql`update mastery_scores set
    score = ${m.score},
    attempts = ${m.attempts},
    correct_count = ${m.correctCount},
    recent_accuracy = ${m.recentAccuracy},
    confidence = ${m.confidence},
    mistake_frequency = ${m.mistakeFrequency},
    retention_score = ${m.retentionScore},
    last_practiced_at = ${m.lastPracticedAt},
    next_review_at = ${m.nextReviewAt},
    interval_days = ${m.intervalDays},
    easiness = ${m.easiness},
    updated_at = now()
  where user_id = ${userId} and skill_id = ${m.skillId}`;
}

export async function applyEvidence(
  sql: Sql,
  userId: string,
  skillIds: string[],
  ev: { correct: boolean; difficulty: number; timeMs: number; mistakeCount: number },
) {
  const unique = [...new Set(skillIds.filter((id) => SKILL_BY_ID[id]))];
  if (unique.length === 0) return;
  for (const id of unique) {
    const rows = await sql<MasteryRow>`select * from mastery_scores where user_id = ${userId} and skill_id = ${id}`;
    const current = rows[0] ? rowToMastery(rows[0]) : emptyMastery(id);
    const next = applyAttempt(current, { ...ev, skillId: id });
    await saveMastery(sql, userId, next);
  }
}

export async function rankForUser(sql: Sql, userId: string, targetGrade: number): Promise<RankedSkill[]> {
  const mastery = await loadMastery(sql, userId);
  const masteryMap = new Map(mastery.map((m) => [m.skillId, m]));
  const recent = await sql<{ skill_id: string | null; n: number }>`
    select skill_id, count(*)::int as n from mistakes
    where user_id = ${userId} and created_at > now() - interval '21 days'
    group by skill_id`;
  const mistakeMap = new Map(recent.map((r) => [r.skill_id ?? "", r.n]));
  const deps = await sql<{ prerequisite_id: string; n: number }>`
    select prerequisite_id, count(*)::int as n from skill_prerequisites group by prerequisite_id`;
  const depMap = new Map(deps.map((d) => [d.prerequisite_id, d.n]));

  return rankPriorities(
    SKILLS.map((skill) => ({
      skill,
      mastery: masteryMap.get(skill.id) ?? emptyMastery(skill.id),
      recentMistakes: mistakeMap.get(skill.id) ?? 0,
      dependents: depMap.get(skill.id) ?? 0,
      targetGrade,
    })),
  );
}

export function parseSkillIds(raw: string | null | undefined): string[] {
  return parseJson<string[]>(raw, []);
}
