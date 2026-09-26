import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { SKILL_BY_ID, SKILLS, TOPICS } from "@/lib/curriculum/data";
import { BANK_QUESTIONS } from "@/lib/curriculum/questions";
import {
  analyzeQuestionImage,
  analyzeTypedQuestion,
  analyzeWorking,
  generateQuestion,
  tutorOnQuestion,
  writeWeeklyReview,
} from "@/lib/ai/services";
import { NEED_AI_KEY, aiAvailable, geminiKeyHint, probeGeminiKey } from "@/lib/ai/client";
import { estimateGrade } from "@/lib/engines/mastery";
import { buildNextWeekPlan, buildTodayPlan, buildWeekPlan, type PlanItem } from "@/lib/engines/planner";
import { answersMatch, newId, parseJson, startOfWeekISO, todayISO } from "@/lib/utils";
import { withStudent } from "@/lib/server/ensure";
import {
  applyEvidence,
  loadMastery,
  parseSkillIds,
  rankForUser,
} from "@/lib/server/mastery-apply";
import type { WorkingAnalysis } from "@/lib/ai/schemas";

const MAX_IMAGE = 1_800_000;

function promptKey(prompt: string) {
  return prompt.toLowerCase().replace(/\s+/g, " ").trim();
}

function displayNameFromContext(context: { userId: string } & Record<string, unknown>) {
  const u = context as { userId: string; user?: { name?: string | null } };
  return u.user?.name ?? "Student";
}

function gradeInput(mastery: { skillId: string; score: number | null; attempts: number }[]) {
  const map = new Map(mastery.map((m) => [m.skillId, m]));
  return SKILLS.map((s) => {
    const m = map.get(s.id);
    return {
      score: m?.score ?? null,
      attempts: m?.attempts ?? 0,
      relevance: s.relevance,
      examFreq: s.examFreq,
      gradeMin: s.gradeMin,
      gradeMax: s.gradeMax,
      category: s.category,
    };
  });
}

export const getBootstrap = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const profiles = await sql<{
        user_id: string;
        display_name: string;
        exam_board: string;
        target_grade: number;
        weekly_minutes_goal: number;
        calculator_preference: string;
        onboarding_complete: boolean;
        current_streak: number;
        longest_streak: number;
        last_active_date: string | null;
        total_minutes: number;
        gemini_api_key: string | null;
      }>`select user_id, display_name, exam_board, target_grade, weekly_minutes_goal,
        calculator_preference, onboarding_complete, current_streak, longest_streak,
        last_active_date, total_minutes, gemini_api_key
        from student_profiles where user_id = ${context.userId}`;
      const row = profiles[0];
      const profile = {
        user_id: row.user_id,
        display_name: row.display_name,
        exam_board: row.exam_board,
        target_grade: row.target_grade,
        weekly_minutes_goal: row.weekly_minutes_goal,
        calculator_preference: row.calculator_preference,
        onboarding_complete: row.onboarding_complete,
        current_streak: row.current_streak,
        longest_streak: row.longest_streak,
        last_active_date: row.last_active_date,
        total_minutes: row.total_minutes,
      };
      const mastery = await loadMastery(sql, context.userId);
      const ranked = await rankForUser(sql, context.userId, profile.target_grade);
      const grade = estimateGrade(gradeInput(mastery));

      const weekStart = startOfWeekISO();
      const weekAttempts = await sql<{ n: number; correct: number; minutes: number }>`
        select count(*)::int as n,
          coalesce(sum(case when is_correct then 1 else 0 end),0)::int as correct,
          coalesce(sum(time_ms),0)::int as minutes
        from question_attempts
        where user_id = ${context.userId} and created_at >= ${weekStart}::timestamptz`;

      const recentMistakes = await sql<{
        id: string;
        category: string;
        skill_id: string | null;
        what_student_did: string;
        created_at: string;
      }>`select id, category, skill_id, what_student_did, created_at from mistakes
        where user_id = ${context.userId} order by created_at desc limit 6`;

      const recentAttempts = await sql<{
        id: string;
        is_correct: boolean | null;
        created_at: string;
        question_id: string;
      }>`select id, is_correct, created_at, question_id from question_attempts
        where user_id = ${context.userId} order by created_at desc limit 8`;

      const improved = mastery
        .filter((m) => m.score !== null && m.attempts >= 2 && (m.recentAccuracy ?? 0) > (m.score ?? 0))
        .map((m) => ({
          name: SKILL_BY_ID[m.skillId]?.name ?? m.skillId,
          delta: Math.round((m.recentAccuracy - (m.score ?? 0)) * 10) / 10,
          skillId: m.skillId,
        }))
        .filter((x) => x.delta >= 2)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 4);

      const weak = ranked.filter((r) => r.mastery !== null).slice(0, 5);
      const todayPlan = buildTodayPlan(ranked, ranked.find((r) => r.reason.includes("repeated")) ?? null);

      const lastSession = await sql<{ started_at: string }>`
        select started_at from study_sessions where user_id = ${context.userId} order by started_at desc limit 1`;
      const missedToday =
        profile.last_active_date !== todayISO() &&
        lastSession.length > 0 &&
        profile.onboarding_complete;

      return {
        profile,
        gradeEstimate: grade.estimate,
        assessedSkills: grade.assessedSkills,
        gradeConfidence: grade.confidence,
        pathToNine: grade.pathToNine,
        whyNotNine: grade.whyNotNine,
        ranked: ranked.slice(0, 12),
        weak: weak.slice(0, 3),
        improved,
        todayPlan,
        recentMistakes: recentMistakes.map((m) => ({
          ...m,
          skillName: m.skill_id ? SKILL_BY_ID[m.skill_id]?.name ?? m.skill_id : "General",
        })),
        recentAttempts,
        week: {
          questions: weekAttempts[0]?.n ?? 0,
          correct: weekAttempts[0]?.correct ?? 0,
          minutes: Math.round((weekAttempts[0]?.minutes ?? 0) / 60000),
        },
        missedToday,
        aiAvailable: Boolean(row.gemini_api_key),
        geminiKey: geminiKeyHint(row.gemini_api_key ?? ""),
        skillsCount: SKILLS.length,
      };
    });
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    displayName?: string;
    examBoard?: string;
    weeklyMinutes?: number;
    calculator?: string;
    onboardingComplete?: boolean;
    targetGrade?: number;
  }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      await sql`update student_profiles set
        display_name = coalesce(${data.displayName ?? null}, display_name),
        exam_board = coalesce(${data.examBoard ?? null}, exam_board),
        weekly_minutes_goal = coalesce(${data.weeklyMinutes ?? null}, weekly_minutes_goal),
        calculator_preference = coalesce(${data.calculator ?? null}, calculator_preference),
        onboarding_complete = coalesce(${data.onboardingComplete ?? null}, onboarding_complete),
        target_grade = coalesce(${data.targetGrade ?? null}, target_grade),
        updated_at = now()
        where user_id = ${context.userId}`;
      return { ok: true as const };
    });
  });

export const saveGeminiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { key: string }) => input)
  .handler(async ({ context, data }) => {
    const key = (data.key ?? "").trim();
    const probe = await probeGeminiKey(key);
    if (!probe.ok) return { ok: false as const, error: probe.error };
    const cleaned = key.replace(/\s+/g, "");
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      await sql`update student_profiles set gemini_api_key = ${cleaned}, updated_at = now()
        where user_id = ${context.userId}`;
      return { ok: true as const, hint: geminiKeyHint(cleaned) };
    });
  });

export const captureQuestion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    mime: string;
    base64: string;
    typedText?: string;
  }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      if (!aiAvailable()) return { ok: false as const, error: NEED_AI_KEY };
      let analysis;
      let imageId: string | null = null;
      if (data.base64) {
        const size = Math.ceil((data.base64.length * 3) / 4);
        if (size > MAX_IMAGE) return { ok: false as const, error: "Image is too large. Use a screenshot under about 1.5 MB." };
        if (!/^image\/(png|jpe?g|webp|heic|gif)$/i.test(data.mime) && data.mime !== "image/jpeg") {
          return { ok: false as const, error: "Please upload a PNG, JPEG or WebP screenshot." };
        }
        imageId = newId();
        await sql`insert into uploaded_images (id, user_id, kind, mime, data_base64, size_bytes)
          values (${imageId}, ${context.userId}, 'question', ${data.mime}, ${data.base64}, ${size})`;
        const result = await analyzeQuestionImage({ mime: data.mime, base64: data.base64 });
        if (!result.ok) return { ok: false as const, error: result.error };
        analysis = result.data;
      } else if (data.typedText?.trim()) {
        const result = await analyzeTypedQuestion(data.typedText.trim());
        if (!result.ok) {
          analysis = {
            question_text: data.typedText.trim(),
            topic: "Algebra",
            subtopic: "Unclassified",
            skill_ids: ["alg.solving-linear"],
            difficulty: 5,
            estimated_grade: 5,
            question_type: "structured",
            marks: null,
            command_words: [],
            prerequisites: [],
            calculator: null,
            notes: "AI was unavailable, so this was saved as typed text. Confirm the topic.",
            confidence: 0.2,
            needs_confirmation: true,
            prompt_latex: null,
          };
        } else analysis = result.data;
      } else {
        return { ok: false as const, error: "Upload a screenshot or type the question." };
      }

      const known = analysis.skill_ids.filter((id) => SKILL_BY_ID[id]);
      if (known.length === 0) {
        const guess = SKILLS.find((s) =>
          analysis.subtopic.toLowerCase().includes(s.name.toLowerCase().split(" ")[0] ?? ""),
        );
        if (guess) known.push(guess.id);
      }
      const qid = newId();
      await sql`insert into questions (
        id, user_id, source, prompt, prompt_latex, marks, skill_ids, topic_id,
        difficulty, calculator, question_type, command_words, image_id, confirmed
      ) values (
        ${qid}, ${context.userId}, ${data.base64 ? "capture" : "manual"}, ${analysis.question_text},
        ${analysis.prompt_latex ?? null}, ${analysis.marks ?? null}, ${JSON.stringify(known)},
        ${TOPICS.find((t) => t.name === analysis.topic)?.id ?? "algebra"},
        ${Math.round(analysis.difficulty)}, ${analysis.calculator ?? null},
        ${analysis.question_type}, ${JSON.stringify(analysis.command_words)}, ${imageId}, false
      )`;
      return { ok: true as const, questionId: qid, analysis: { ...analysis, skill_ids: known } };
    });
  });

export const confirmQuestion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { questionId: string; prompt?: string; skillIds?: string[] }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      await sql`update questions set
        confirmed = true,
        prompt = coalesce(${data.prompt ?? null}, prompt),
        skill_ids = coalesce(${data.skillIds ? JSON.stringify(data.skillIds) : null}, skill_ids)
        where id = ${data.questionId} and user_id = ${context.userId}`;
      return { ok: true as const };
    });
  });

export const getQuestion = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const rows = await sql<{
        id: string;
        prompt: string;
        prompt_latex: string | null;
        marks: number | null;
        answer: string | null;
        worked_solution: string | null;
        skill_ids: string;
        difficulty: number;
        calculator: boolean | null;
        question_type: string;
        source: string;
        confirmed: boolean;
        image_id: string | null;
        user_id: string | null;
      }>`select * from questions where id = ${data.id} and (user_id = ${context.userId} or user_id is null)`;
      const q = rows[0];
      if (!q) return { ok: false as const, error: "Question not found." };
      let image: { mime: string; data: string } | null = null;
      if (q.image_id) {
        const imgs = await sql<{ mime: string; data_base64: string }>`
          select mime, data_base64 from uploaded_images where id = ${q.image_id} and user_id = ${context.userId}`;
        if (imgs[0]) image = { mime: imgs[0].mime, data: imgs[0].data_base64 };
      }
      const attempts = await sql<{
        id: string;
        is_correct: boolean | null;
        working_text: string | null;
        analysis_json: string | null;
        created_at: string;
      }>`select id, is_correct, working_text, analysis_json, created_at from question_attempts
        where question_id = ${q.id} and user_id = ${context.userId} order by created_at desc`;
      const skills = parseSkillIds(q.skill_ids)
        .map((sid) => SKILL_BY_ID[sid])
        .filter((s): s is NonNullable<typeof s> => Boolean(s));
      return {
        ok: true as const,
        question: q,
        image,
        attempts,
        skills,
        revealAnswer: attempts.some((a) => a.is_correct !== null),
      };
    });
  });

export const submitWorking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    questionId: string;
    workingText?: string;
    imageMime?: string;
    imageBase64?: string;
    confidence?: number;
    timeMs?: number;
  }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const qs = await sql<{
        id: string;
        prompt: string;
        answer: string | null;
        skill_ids: string;
        difficulty: number;
        user_id: string | null;
      }>`select id, prompt, answer, skill_ids, difficulty, user_id from questions
        where id = ${data.questionId} and (user_id = ${context.userId} or user_id is null)`;
      const q = qs[0];
      if (!q) return { ok: false as const, error: "Question not found." };

      let workingImageId: string | null = null;
      let img: { mime: string; base64: string } | undefined;
      if (data.imageBase64 && data.imageMime) {
        const size = Math.ceil((data.imageBase64.length * 3) / 4);
        if (size > MAX_IMAGE) return { ok: false as const, error: "Working image is too large." };
        workingImageId = newId();
        await sql`insert into uploaded_images (id, user_id, kind, mime, data_base64, size_bytes)
          values (${workingImageId}, ${context.userId}, 'working', ${data.imageMime}, ${data.imageBase64}, ${size})`;
        img = { mime: data.imageMime, base64: data.imageBase64 };
      }

      const skillIds = parseSkillIds(q.skill_ids);
      let analysis: WorkingAnalysis | null = null;
      const ai = await analyzeWorking({
        question: q.prompt,
        expectedAnswer: q.answer,
        workingText: data.workingText,
        workingImage: img,
        skillIds,
      });
      if (ai.ok) analysis = ai.data;

      let isCorrect = analysis?.is_correct ?? null;
      if (isCorrect === null && data.workingText && q.answer) {
        isCorrect = answersMatch(data.workingText, q.answer);
      }
      if (isCorrect === null && !data.workingText && !img) {
        return { ok: false as const, error: "Type your working or upload a photo of it." };
      }
      if (isCorrect === null) isCorrect = false;

      const attemptId = newId();
      await sql`insert into question_attempts (
        id, user_id, question_id, working_text, working_image_id, is_correct, time_ms, confidence, analysis_json
      ) values (
        ${attemptId}, ${context.userId}, ${q.id}, ${data.workingText ?? null}, ${workingImageId},
        ${isCorrect}, ${data.timeMs ?? 0}, ${data.confidence ?? null}, ${analysis ? JSON.stringify(analysis) : null}
      )`;

      const mistakes = analysis?.mistakes ?? [];
      for (const m of mistakes) {
        await sql`insert into mistakes (
          id, user_id, attempt_id, question_id, skill_id, category,
          what_student_did, what_should, why_wrong, how_to_avoid, difficulty, corrected
        ) values (
          ${newId()}, ${context.userId}, ${attemptId}, ${q.id}, ${m.skill_id ?? skillIds[0] ?? null},
          ${m.category}, ${m.what_student_did}, ${m.what_should_happen}, ${m.why_wrong}, ${m.how_to_avoid},
          ${q.difficulty}, ${isCorrect}
        )`;
      }

      await applyEvidence(sql, context.userId, skillIds.length ? skillIds : ["alg.solving-linear"], {
        correct: isCorrect,
        difficulty: q.difficulty,
        timeMs: data.timeMs ?? 0,
        mistakeCount: mistakes.length,
      });

      await sql`update student_profiles set
        last_active_date = ${todayISO()}::date,
        current_streak = case
          when last_active_date = ${todayISO()}::date then current_streak
          when last_active_date = (${todayISO()}::date - 1) then current_streak + 1
          else 1 end,
        longest_streak = greatest(longest_streak, case
          when last_active_date = ${todayISO()}::date then current_streak
          when last_active_date = (${todayISO()}::date - 1) then current_streak + 1
          else 1 end),
        updated_at = now()
        where user_id = ${context.userId}`;

      return {
        ok: true as const,
        attemptId,
        isCorrect,
        analysis,
        aiError: ai.ok ? null : ai.error,
      };
    });
  });

export const askTutor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    questionId: string;
    mode: "explain" | "hint" | "stronger_hint" | "method" | "solution";
    workingText?: string;
  }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const qs = await sql<{ prompt: string; worked_solution: string | null; answer: string | null }>`
        select prompt, worked_solution, answer from questions
        where id = ${data.questionId} and (user_id = ${context.userId} or user_id is null)`;
      const q = qs[0];
      if (!q) return { ok: false as const, error: "Question not found." };

      if (data.mode === "solution" && q.worked_solution) {
        return {
          ok: true as const,
          content: `${q.worked_solution}${q.answer ? `\n\n**Answer:** ${q.answer.split("|")[0]}` : ""}`,
          revealsAnswer: true,
        };
      }

      const result = await tutorOnQuestion({
        question: q.prompt,
        mode: data.mode,
        previous: data.workingText,
      });
      if (!result.ok) {
        if (data.mode === "hint") {
          return {
            ok: true as const,
            content: "Start by identifying the command word and writing down the formula or rule that matches this topic. Attempt one step before asking for a stronger hint.",
            revealsAnswer: false,
          };
        }
        return { ok: false as const, error: result.error };
      }
      const conv = newId();
      await sql`insert into ai_conversations (id, user_id, question_id, kind)
        values (${conv}, ${context.userId}, ${data.questionId}, ${data.mode})`;
      await sql`insert into ai_messages (id, conversation_id, user_id, role, content)
        values (${newId()}, ${conv}, ${context.userId}, 'assistant', ${result.data.content})`;
      return { ok: true as const, content: result.data.content, revealsAnswer: result.data.reveals_answer };
    });
  });

export const startPractice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { skillId?: string; mode?: "adaptive" | "skill" | "mistakes" } | undefined) => input ?? {})
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const profiles = await sql<{ target_grade: number; calculator_preference: string }>`
        select target_grade, calculator_preference from student_profiles where user_id = ${context.userId}`;
      const ranked = await rankForUser(sql, context.userId, profiles[0]?.target_grade ?? 9);
      const skillId = data.skillId || ranked[0]?.skillId || "alg.solving-linear";
      const masteryRows = await sql<{ score: number | null; attempts: number }>`
        select score, attempts from mastery_scores where user_id = ${context.userId} and skill_id = ${skillId}`;
      const score = masteryRows[0]?.score;
      let band = score === null ? 5 : score < 45 ? 4 : score < 65 ? 5 : score < 80 ? 7 : 8;

      const attempted = await sql<{ question_id: string }>`
        select distinct question_id from question_attempts where user_id = ${context.userId}`;
      const attemptedSet = new Set(attempted.map((a) => a.question_id));
      const priorRows = await sql<{ prompt: string }>`select q.prompt from question_attempts a
        join questions q on q.id = a.question_id where a.user_id = ${context.userId}
        order by a.created_at desc limit 80`;
      const priorPrompts = priorRows.map((row) => row.prompt);
      const priorKeys = new Set(priorPrompts.map(promptKey));

      const bank = BANK_QUESTIONS.filter((q) => q.skillIds.includes(skillId) && !attemptedSet.has(q.id));
      let chosen = bank.sort((a, b) => Math.abs(a.difficulty - band) - Math.abs(b.difficulty - band))[0];

      if (!chosen) {
        for (let generation = 0; generation < 3; generation++) {
          const gen = await generateQuestion({
            skillId,
            skillName: SKILL_BY_ID[skillId]?.name ?? skillId,
            difficulty: band,
            calculator: profiles[0]?.calculator_preference !== "non-calculator",
            avoidPrompts: priorPrompts,
          });
          if (!gen.ok || priorKeys.has(promptKey(gen.data.prompt))) continue;
          const id = newId();
          await sql`insert into questions (
            id, user_id, source, prompt, marks, answer, worked_solution, skill_ids, topic_id,
            difficulty, calculator, question_type, common_mistakes, confirmed
          ) values (
            ${id}, ${context.userId}, 'generated', ${gen.data.prompt}, ${gen.data.marks}, ${gen.data.answer},
            ${gen.data.worked_solution}, ${JSON.stringify(gen.data.skill_ids)}, ${SKILL_BY_ID[skillId]?.topicId ?? "algebra"},
            ${gen.data.difficulty}, ${gen.data.calculator}, ${gen.data.question_type},
            ${JSON.stringify(gen.data.common_mistakes)}, true
          )`;
          return { ok: true as const, questionId: id, skillId, reason: ranked[0]?.whyItMatters ?? "" };
        }
        // Never fall back to a bank question the student has already attempted.
        // Repeating is only allowed when they deliberately reopen that question.
        return {
          ok: false as const,
          error: "A new question could not be generated just now. Please try again — an old question will not be repeated.",
        };
      }
      return { ok: true as const, questionId: chosen.id, skillId, reason: ranked.find((r) => r.skillId === skillId)?.whyItMatters ?? "" };
    });
  });

export const listProgress = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const mastery = await loadMastery(sql, context.userId);
      const byCat: Record<string, { name: string; score: number | null; attempts: number; id: string }[]> = {};
      for (const m of mastery) {
        const s = SKILL_BY_ID[m.skillId];
        if (!s) continue;
        (byCat[s.category] ??= []).push({
          id: s.id,
          name: s.name,
          score: m.score,
          attempts: m.attempts,
        });
      }
      const totals = mastery.filter((m) => m.attempts > 0);
      const overall =
        totals.length === 0
          ? null
          : totals.reduce((a, m) => a + (m.score ?? 0), 0) / totals.length;
      return { byCat, overall, assessed: totals.length, total: mastery.length };
    });
  });

export const getPlans = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const profiles = await sql<{ target_grade: number }>`select target_grade from student_profiles where user_id = ${context.userId}`;
      const ranked = await rankForUser(sql, context.userId, profiles[0]?.target_grade ?? 9);
      const today = buildTodayPlan(ranked, ranked.find((r) => r.reason.includes("repeated")) ?? null);
      const week = buildWeekPlan(ranked);
      const next = buildNextWeekPlan(ranked);
      const date = todayISO();
      for (const plan of [today, week, next]) {
        await sql`insert into revision_plans (id, user_id, period, plan_date, minutes, rationale, items_json)
          values (${newId()}, ${context.userId}, ${plan.period}, ${date}::date, ${plan.minutes}, ${plan.rationale}, ${JSON.stringify(plan.items)})
          on conflict (user_id, period, plan_date) do update set
            minutes = excluded.minutes, rationale = excluded.rationale, items_json = excluded.items_json`;
      }
      return { today, week, next, ranked: ranked.slice(0, 8) };
    });
  });

export const listMistakes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const rows = await sql<{
        id: string;
        category: string;
        skill_id: string | null;
        what_student_did: string;
        what_should: string;
        why_wrong: string;
        how_to_avoid: string;
        corrected: boolean;
        created_at: string;
      }>`select id, category, skill_id, what_student_did, what_should, why_wrong, how_to_avoid, corrected, created_at
        from mistakes where user_id = ${context.userId} order by created_at desc limit 80`;
      const grouped = await sql<{ category: string; n: number }>`
        select category, count(*)::int as n from mistakes where user_id = ${context.userId}
        group by category order by n desc`;
      const pattern =
        grouped[0] && grouped[0].n >= 3
          ? `${grouped[0].category} has appeared ${grouped[0].n} times. That is a pattern — practise this specifically, not just the topic.`
          : grouped[0]
            ? `Most common so far: ${grouped[0].category}. Not yet a pattern.`
            : "No mistakes recorded yet. Capture a question and upload your working.";
      return {
        rows: rows.map((r) => ({ ...r, skillName: r.skill_id ? SKILL_BY_ID[r.skill_id]?.name ?? r.skill_id : "General" })),
        grouped,
        pattern,
      };
    });
  });

export const getGrade9 = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const profiles = await sql<{ target_grade: number }>`select target_grade from student_profiles where user_id = ${context.userId}`;
      const target = profiles[0]?.target_grade ?? 9;
      const ranked = await rankForUser(sql, context.userId, target);
      const mastery = await loadMastery(sql, context.userId);
      const grade = estimateGrade(gradeInput(mastery));
      const blockers = ranked
        .filter((r) => {
          const s = SKILL_BY_ID[r.skillId];
          return s && s.gradeMax >= 8;
        })
        .slice(0, 6)
        .map((r) => {
          const s = SKILL_BY_ID[r.skillId]!;
          const prereq = s.prereq.map((id) => SKILL_BY_ID[id]?.name ?? id);
          return {
            ...r,
            targetMastery: 85,
            effortHours: r.mastery === null ? 4 : Math.max(1, Math.round((85 - r.mastery) / 12)),
            prerequisites: prereq,
          };
        });
      return {
        estimate: grade.estimate,
        assessed: grade.assessedSkills,
        target,
        blockers,
        confidence: grade.confidence,
        coverage: grade.coverage,
        pathToNine: grade.pathToNine,
        higherReady: grade.higherReady,
        algebraReady: grade.algebraReady,
        bandLow: grade.bandLow,
        bandHigh: grade.bandHigh,
        whyNotNine: grade.whyNotNine,
        strands: grade.strands,
      };
    });
  });

function pickDiagnostic(kind: string, skillId?: string) {
  let pool = [...BANK_QUESTIONS];
  if (kind === "topic" && skillId) {
    const cat = SKILL_BY_ID[skillId]?.category;
    pool = pool.filter((q) => q.skillIds.some((id) => SKILL_BY_ID[id]?.category === cat));
  }
  if (kind === "grade9") pool = pool.filter((q) => q.difficulty >= 6);
  const n = kind === "quick" ? 10 : kind === "topic" ? 20 : kind === "grade9" ? 15 : 32;
  const shuffled = pool.sort(() => Math.random() - 0.5);
  const picked: typeof BANK_QUESTIONS = [];
  const seen = new Set<string>();
  for (const q of shuffled) {
    const key = q.skillIds[0] ?? q.id;
    if (kind !== "grade9" && kind !== "topic" && seen.has(key) && picked.length < n / 2) continue;
    seen.add(key);
    picked.push(q);
    if (picked.length >= n) break;
  }
  while (picked.length < Math.min(n, pool.length)) {
    const extra = pool[picked.length % pool.length];
    if (!picked.includes(extra)) picked.push(extra);
    else break;
  }
  return picked.slice(0, n);
}

export const startTest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    kind: "quick" | "topic" | "full" | "grade9" | "exam";
    skillId?: string;
    calculator?: "calculator" | "non-calculator" | "either";
    timed?: boolean;
  }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const questions = pickDiagnostic(data.kind, data.skillId);
      if (data.kind === "exam") {
        const calc = data.calculator === "non-calculator" ? false : data.calculator === "calculator" ? true : null;
        const examPool = BANK_QUESTIONS.filter((q) => (calc === null ? true : q.calculator === calc));
        questions.length = 0;
        questions.push(...examPool.sort(() => Math.random() - 0.5).slice(0, 20));
      }
      const titles: Record<string, string> = {
        quick: "Quick diagnostic",
        topic: "Topic diagnostic",
        full: "Full diagnostic",
        grade9: "Grade 9 diagnostic",
        exam: "Exam simulator",
      };
      const timed = data.timed ?? data.kind === "exam";
      const timeLimit = data.kind === "exam" ? 45 * 60 : data.kind === "full" ? 40 * 60 : timed ? 15 * 60 : null;
      const id = newId();
      const ids = questions.map((q) => q.id);
      const max = questions.reduce((a, q) => a + q.marks, 0);
      await sql`insert into diagnostic_tests (
        id, user_id, kind, title, timed, time_limit_s, calculator, status, question_ids, max_score
      ) values (
        ${id}, ${context.userId}, ${data.kind}, ${titles[data.kind]}, ${timed}, ${timeLimit},
        ${data.calculator ?? "either"}, 'active', ${JSON.stringify(ids)}, ${max}
      )`;
      return { ok: true as const, testId: id };
    });
  });

export const getTest = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const tests = await sql<{
        id: string;
        kind: string;
        title: string;
        timed: boolean;
        time_limit_s: number | null;
        calculator: string;
        status: string;
        question_ids: string;
        started_at: string;
        score: number | null;
        max_score: number | null;
        analysis_json: string | null;
      }>`select * from diagnostic_tests where id = ${data.id} and user_id = ${context.userId}`;
      const test = tests[0];
      if (!test) return { ok: false as const, error: "Test not found." };
      const ids = parseJson<string[]>(test.question_ids, []);
      const questions = BANK_QUESTIONS.filter((q) => ids.includes(q.id)).sort(
        (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id),
      );
      const answers = await sql<{
        question_id: string;
        response: string | null;
        flagged: boolean;
        is_correct: boolean | null;
      }>`select question_id, response, flagged, is_correct from test_answers where test_id = ${test.id} and user_id = ${context.userId}`;
      return { ok: true as const, test, questions: questions.map((q) => ({ ...q, answer: test.status === "completed" ? q.answer : undefined, solution: test.status === "completed" ? q.solution : undefined })), answers };
    });
  });

export const saveTestAnswer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { testId: string; questionId: string; response?: string; flagged?: boolean }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const id = newId();
      await sql`insert into test_answers (id, user_id, test_id, question_id, response, flagged)
        values (${id}, ${context.userId}, ${data.testId}, ${data.questionId}, ${data.response ?? null}, ${data.flagged ?? false})
        on conflict (test_id, question_id) do update set
          response = coalesce(${data.response ?? null}, test_answers.response),
          flagged = coalesce(${data.flagged ?? null}, test_answers.flagged),
          updated_at = now()`;
      return { ok: true as const };
    });
  });

export const completeTest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { testId: string }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const tests = await sql<{ question_ids: string; kind: string }>`
        select question_ids, kind from diagnostic_tests where id = ${data.testId} and user_id = ${context.userId}`;
      const test = tests[0];
      if (!test) return { ok: false as const, error: "Test not found." };
      const ids = parseJson<string[]>(test.question_ids, []);
      const answers = await sql<{ question_id: string; response: string | null }>`
        select question_id, response from test_answers where test_id = ${data.testId} and user_id = ${context.userId}`;
      const map = new Map(answers.map((a) => [a.question_id, a.response ?? ""]));
      let score = 0;
      let max = 0;
      const lost: Record<string, number> = {};
      for (const id of ids) {
        const q = BANK_QUESTIONS.find((x) => x.id === id);
        if (!q) continue;
        max += q.marks;
        const ok = answersMatch(map.get(id) ?? "", q.answer);
        if (ok) score += q.marks;
        else {
          for (const s of q.skillIds) lost[s] = (lost[s] ?? 0) + q.marks;
        }
        await sql`update test_answers set is_correct = ${ok} where test_id = ${data.testId} and question_id = ${id} and user_id = ${context.userId}`;
        await applyEvidence(sql, context.userId, q.skillIds, {
          correct: ok,
          difficulty: q.difficulty,
          timeMs: 0,
          mistakeCount: ok ? 0 : 1,
        });
        if (!ok && (map.get(id) ?? "").trim()) {
          await sql`insert into mistakes (
            id, user_id, attempt_id, question_id, skill_id, category,
            what_student_did, what_should, why_wrong, how_to_avoid, difficulty, corrected
          ) values (
            ${newId()}, ${context.userId}, ${data.testId}, ${q.id}, ${q.skillIds[0] ?? null},
            ${"exam technique"}, ${map.get(id) ?? "(blank)"}, ${q.answer.split("|")[0]},
            ${"Final answer did not match."}, ${q.commonMistakes[0] ?? "Revisit the method, then retry a similar question."},
            ${q.difficulty}, false
          )`;
        }
      }
      const analysis = {
        score,
        max,
        accuracy: max ? Math.round((score / max) * 100) : 0,
        topicsLost: Object.entries(lost)
          .map(([id, marks]) => ({ skill: SKILL_BY_ID[id]?.name ?? id, marks }))
          .sort((a, b) => b.marks - a.marks)
          .slice(0, 6),
        note: "This is an internal learning check, not an official GCSE prediction.",
      };
      await sql`update diagnostic_tests set status = 'completed', completed_at = now(), score = ${score}, max_score = ${max}, analysis_json = ${JSON.stringify(analysis)}
        where id = ${data.testId} and user_id = ${context.userId}`;
      return { ok: true as const, analysis };
    });
  });

export const listTests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      return sql<{
        id: string;
        kind: string;
        title: string;
        status: string;
        score: number | null;
        max_score: number | null;
        started_at: string;
      }>`select id, kind, title, status, score, max_score, started_at from diagnostic_tests
        where user_id = ${context.userId} order by started_at desc limit 20`;
    });
  });

export const addAssignment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { title: string; topic?: string; scoreRaw?: string; scorePercent?: number; notes?: string; provider?: string }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      await sql`insert into assignments (id, user_id, provider, title, topic, score_raw, score_percent, assigned_at, notes)
        values (${newId()}, ${context.userId}, ${data.provider ?? "manual"}, ${data.title}, ${data.topic ?? null},
          ${data.scoreRaw ?? null}, ${data.scorePercent ?? null}, ${todayISO()}::date, ${data.notes ?? null})`;
      return { ok: true as const };
    });
  });

export const listAssignments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      return sql<{
        id: string;
        title: string;
        topic: string | null;
        score_raw: string | null;
        score_percent: number | null;
        provider: string;
        created_at: string;
      }>`select id, title, topic, score_raw, score_percent, provider, created_at from assignments
        where user_id = ${context.userId} order by created_at desc limit 40`;
    });
  });

export const importResults = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { csv: string }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const lines = data.csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return { ok: false as const, error: "Need a header row plus at least one result." };
      const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
      const idx = (name: string) => header.indexOf(name);
      let n = 0;
      for (const line of lines.slice(1)) {
        const cols = line.split(",").map((c) => c.trim());
        const title = cols[idx("title")] || cols[idx("topic")] || cols[0];
        if (!title) continue;
        const topic = cols[idx("topic")] || null;
        const scoreRaw = cols[idx("score")] || cols[idx("score_raw")] || null;
        const pct = Number(cols[idx("percent")] || cols[idx("score_percent")] || "");
        await sql`insert into assignments (id, user_id, provider, title, topic, score_raw, score_percent, assigned_at)
          values (${newId()}, ${context.userId}, 'import', ${title}, ${topic}, ${scoreRaw}, ${Number.isFinite(pct) ? pct : null}, ${todayISO()}::date)`;
        n++;
      }
      return { ok: true as const, imported: n };
    });
  });

export const getWeeklyReview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const weekStart = startOfWeekISO();
      const cached = await sql<{ summary_json: string }>`
        select summary_json from weekly_reviews where user_id = ${context.userId} and week_start = ${weekStart}::date`;
      const attempts = await sql<{ n: number; correct: number; time: number }>`
        select count(*)::int as n,
          coalesce(sum(case when is_correct then 1 else 0 end),0)::int as correct,
          coalesce(sum(time_ms),0)::int as time
        from question_attempts where user_id = ${context.userId} and created_at >= ${weekStart}::timestamptz`;
      const mastery = await loadMastery(sql, context.userId);
      const improved = mastery
        .filter((m) => m.score !== null && m.recentAccuracy - (m.score ?? 0) >= 3)
        .sort((a, b) => (b.recentAccuracy - (b.score ?? 0)) - (a.recentAccuracy - (a.score ?? 0)))
        .slice(0, 3)
        .map((m) => SKILL_BY_ID[m.skillId]?.name ?? m.skillId);
      const weak = mastery
        .filter((m) => m.score !== null)
        .sort((a, b) => (a.score ?? 100) - (b.score ?? 100))
        .slice(0, 3)
        .map((m) => SKILL_BY_ID[m.skillId]?.name ?? m.skillId);
      const slipping = mastery
        .filter((m) => m.retentionScore < 70 && m.attempts > 0)
        .map((m) => SKILL_BY_ID[m.skillId]?.name ?? m.skillId)
        .slice(0, 4);
      const cats = await sql<{ category: string; n: number }>`
        select category, count(*)::int as n from mistakes
        where user_id = ${context.userId} and created_at >= ${weekStart}::timestamptz
        group by category order by n desc limit 1`;
      const stats = {
        questions: attempts[0]?.n ?? 0,
        accuracy: attempts[0]?.n ? Math.round(((attempts[0].correct ?? 0) / attempts[0].n) * 100) : 0,
        minutes: Math.round((attempts[0]?.time ?? 0) / 60000),
        improved,
        weak,
        slipping,
        repeatedMistake: cats[0] ? `${cats[0].category} × ${cats[0].n}` : "None recorded",
      };
      if (cached[0]) return { ...stats, narrative: parseJson(cached[0].summary_json, stats) };

      const ai = await writeWeeklyReview(stats);
      const narrative = ai.ok
        ? ai.data
        : {
            headline: stats.questions
              ? `You completed ${stats.questions} questions this week at ${stats.accuracy}% accuracy.`
              : "No questions this week yet — the Grade 9 path still needs evidence.",
            accuracy_note: stats.questions ? `Accuracy ${stats.accuracy}%.` : "Start with a 15-minute session.",
            biggest_improvement: improved[0] ?? "Not enough data.",
            biggest_weakness: weak[0] ?? "Not enough data.",
            repeated_mistake: stats.repeatedMistake,
            next_week_priorities: weak,
            coach_note: "Do not wait for a perfect plan. Fifteen minutes now still counts.",
          };
      await sql`insert into weekly_reviews (id, user_id, week_start, summary_json)
        values (${newId()}, ${context.userId}, ${weekStart}::date, ${JSON.stringify(narrative)})
        on conflict (user_id, week_start) do update set summary_json = excluded.summary_json`;
      return { ...stats, narrative };
    });
  });

export const listRecentQuestions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      return sql<{
        id: string;
        prompt: string;
        source: string;
        difficulty: number;
        created_at: string;
        confirmed: boolean;
      }>`select id, prompt, source, difficulty, created_at, confirmed from questions
        where user_id = ${context.userId} order by created_at desc limit 20`;
    });
  });

export const generatePracticeQuestion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { skillId: string; difficulty: number; calculator: boolean }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const skill = SKILL_BY_ID[data.skillId];
      if (!skill) return { ok: false as const, error: "Unknown skill." };
      const priorRows = await sql<{ prompt: string }>`select q.prompt from question_attempts a
        join questions q on q.id = a.question_id where a.user_id = ${context.userId}
        order by a.created_at desc limit 80`;
      const priorPrompts = priorRows.map((row) => row.prompt);
      const priorKeys = new Set(priorPrompts.map(promptKey));
      for (let generation = 0; generation < 3; generation++) {
        const gen = await generateQuestion({
          skillId: skill.id,
          skillName: skill.name,
          difficulty: data.difficulty,
          calculator: data.calculator,
          avoidPrompts: priorPrompts,
        });
        if (!gen.ok) continue;
        if (priorKeys.has(promptKey(gen.data.prompt))) continue;
        const id = newId();
        await sql`insert into questions (
        id, user_id, source, prompt, marks, answer, worked_solution, skill_ids, topic_id,
        difficulty, calculator, question_type, common_mistakes, confirmed
      ) values (
        ${id}, ${context.userId}, 'generated', ${gen.data.prompt}, ${gen.data.marks}, ${gen.data.answer},
        ${gen.data.worked_solution}, ${JSON.stringify([skill.id])}, ${skill.topicId},
        ${gen.data.difficulty}, ${gen.data.calculator}, ${gen.data.question_type},
        ${JSON.stringify(gen.data.common_mistakes)}, true
        )`;
        return { ok: true as const, questionId: id };
      }
      return { ok: false as const, error: "Could not create a genuinely new question. Please try again." };
    });
  });

export type PlanItemDTO = PlanItem;
