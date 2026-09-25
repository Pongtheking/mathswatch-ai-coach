import { BANK_QUESTIONS } from "@/lib/curriculum/questions";
import { SKILLS, TOPICS } from "@/lib/curriculum/data";
import { emptyMastery } from "@/lib/engines/mastery";
import { getSql, type Sql } from "@/lib/db";
import { runWithGeminiKey } from "@/lib/ai/client";

let curriculumReady = false;

export async function ensureCurriculum(sql: Sql): Promise<void> {
  if (curriculumReady) return;
  const topicsN = await sql<{ n: number }>`select count(*)::int as n from topics`;
  if ((topicsN[0]?.n ?? 0) < TOPICS.length) {
    for (let i = 0; i < TOPICS.length; i++) {
      const t = TOPICS[i];
      await sql`insert into topics (id, name, category, description, sort_order)
        values (${t.id}, ${t.name}, ${t.category}, ${t.description}, ${i})
        on conflict (id) do nothing`;
    }
  }
  const skillsN = await sql<{ n: number }>`select count(*)::int as n from skills`;
  if ((skillsN[0]?.n ?? 0) < SKILLS.length) {
    for (let i = 0; i < SKILLS.length; i++) {
      const s = SKILLS[i];
      await sql`insert into skills (
        id, name, category, subtopic, topic_id, tier, difficulty,
        gcse_relevance, target_grade_min, target_grade_max, exam_frequency,
        common_mistakes, sort_order
      ) values (
        ${s.id}, ${s.name}, ${s.category}, ${s.subtopic}, ${s.topicId}, ${s.tier}, ${s.difficulty},
        ${s.relevance}, ${s.gradeMin}, ${s.gradeMax}, ${s.examFreq},
        ${JSON.stringify(s.mistakes)}, ${i}
      ) on conflict (id) do nothing`;
    }
    for (const s of SKILLS) {
      for (const p of s.prereq) {
        await sql`insert into skill_prerequisites (skill_id, prerequisite_id)
          values (${s.id}, ${p}) on conflict do nothing`;
      }
      for (const r of s.related) {
        await sql`insert into skill_related (skill_id, related_id)
          values (${s.id}, ${r}) on conflict do nothing`;
      }
    }
  }
  const qn = await sql<{ n: number }>`select count(*)::int as n from questions where source = 'seed'`;
  if ((qn[0]?.n ?? 0) < BANK_QUESTIONS.length) {
    for (const q of BANK_QUESTIONS) {
      await sql`insert into questions (
        id, user_id, source, prompt, prompt_latex, marks, answer, worked_solution,
        skill_ids, topic_id, difficulty, calculator, question_type, command_words,
        common_mistakes, confirmed
      ) values (
        ${q.id}, null, 'seed', ${q.prompt}, ${q.promptLatex ?? null}, ${q.marks}, ${q.answer}, ${q.solution},
        ${JSON.stringify(q.skillIds)}, ${q.topicId}, ${q.difficulty}, ${q.calculator}, ${q.type},
        ${JSON.stringify(q.commandWords)}, ${JSON.stringify(q.commonMistakes)}, true
      ) on conflict (id) do nothing`;
    }
  }
  curriculumReady = true;
}

export async function ensureStudent(sql: Sql, userId: string, displayName: string) {
  await ensureCurriculum(sql);
  try {
    await sql`alter table student_profiles add column if not exists gemini_api_key text`;
  } catch {
    /* already present or engine without IF NOT EXISTS */
  }
  const existing = await sql<{ user_id: string }>`select user_id from student_profiles where user_id = ${userId}`;
  if (existing.length === 0) {
    await sql`insert into student_profiles (user_id, display_name, target_grade)
      values (${userId}, ${displayName || "Student"}, 9)`;
  }
  const have = await sql<{ n: number }>`select count(*)::int as n from mastery_scores where user_id = ${userId}`;
  if ((have[0]?.n ?? 0) < SKILLS.length) {
    const rows = await sql<{ skill_id: string }>`select skill_id from mastery_scores where user_id = ${userId}`;
    const haveSet = new Set(rows.map((r) => r.skill_id));
    for (const s of SKILLS) {
      if (haveSet.has(s.id)) continue;
      const m = emptyMastery(s.id);
      await sql`insert into mastery_scores (
        user_id, skill_id, score, attempts, correct_count, recent_accuracy, confidence,
        mistake_frequency, retention_score, interval_days, easiness
      ) values (
        ${userId}, ${s.id}, ${m.score}, ${m.attempts}, ${m.correctCount}, ${m.recentAccuracy},
        ${m.confidence}, ${m.mistakeFrequency}, ${m.retentionScore}, ${m.intervalDays}, ${m.easiness}
      ) on conflict do nothing`;
    }
  }
}

export async function withStudent<T>(
  userId: string,
  displayName: string,
  fn: (sql: Sql) => Promise<T>,
): Promise<T> {
  const sql = await getSql();
  await ensureStudent(sql, userId, displayName);
  let key = "";
  try {
    const keys = await sql<{ gemini_api_key: string | null }>`
      select gemini_api_key from student_profiles where user_id = ${userId}`;
    key = keys[0]?.gemini_api_key ?? "";
  } catch {
    /* column may not exist yet on a brand-new file */
  }
  return runWithGeminiKey(key, () => fn(sql));
}
