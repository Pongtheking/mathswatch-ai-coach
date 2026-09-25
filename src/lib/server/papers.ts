import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { SKILL_BY_ID } from "@/lib/curriculum/data";
import { NEED_AI_KEY, aiAvailable } from "@/lib/ai/client";
import { markCompletedScript, mergePaperMarks } from "@/lib/ai/marker";
import type { MarkSchemeParse, PaperMark, PaperParse } from "@/lib/ai/schemas";
import { newId, parseJson } from "@/lib/utils";
import { withStudent } from "@/lib/server/ensure";
import { applyEvidence } from "@/lib/server/mastery-apply";

const MAX_PAGES_PER_REQUEST = 8;
const MAX_EACH = 380_000;

type Img = { mime: string; base64: string; page?: number };

function displayNameFromContext(context: { userId: string } & Record<string, unknown>) {
  const u = context as { userId: string; user?: { name?: string | null } };
  return u.user?.name ?? "Student";
}

function cleanImages(list: Img[] | undefined): Array<{ mime: string; base64: string }> {
  return (list ?? [])
    .filter((img) => img.base64 && img.base64.length < MAX_EACH)
    .slice(0, MAX_PAGES_PER_REQUEST)
    .map((img) => ({
      mime: img.mime.startsWith("image/") ? img.mime : "image/jpeg",
      base64: img.base64.startsWith("data:") ? (img.base64.split(",")[1] ?? "") : img.base64,
    }))
    .filter((img) => img.base64.length > 40);
}

export const listMarkedPapers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const rows = await sql<{
        id: string;
        title: string;
        board: string;
        status: string;
        total_awarded: number | null;
        total_available: number | null;
        created_at: string;
      }>`select id, title, board, status, total_awarded, total_available, created_at
        from papers where user_id = ${context.userId} order by created_at desc limit 30`;
      return { papers: rows, aiAvailable: aiAvailable() };
    });
  });

export const getMarkedPaper = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const rows = await sql<{
        id: string;
        title: string;
        board: string;
        tier: string;
        calculator: string;
        status: string;
        paper_notes: string;
        ms_notes: string;
        mark_json: string | null;
        scheme_json: string | null;
        total_awarded: number | null;
        total_available: number | null;
        created_at: string;
      }>`select * from papers where id = ${data.id} and user_id = ${context.userId}`;
      const paper = rows[0];
      if (!paper) return { ok: false as const, error: "Marked paper not found." };
      const questions = await sql<{
        id: string;
        ref: string;
        prompt: string;
        marks: number;
        skill_ids: string;
        notes: string;
      }>`select id, ref, prompt, marks, skill_ids, notes from paper_questions
        where paper_id = ${paper.id} order by sort_order`;
      const marks = await sql<{
        question_id: string;
        awarded: number;
        max_marks: number;
        points_json: string;
        feedback: string;
        confidence: number;
        needs_review: boolean;
        analysis_json: string | null;
      }>`select question_id, awarded, max_marks, points_json, feedback, confidence, needs_review, analysis_json
        from paper_question_marks where paper_id = ${paper.id}`;
      return {
        ok: true as const,
        paper,
        questions,
        marks,
        report: parseJson<PaperMark | null>(paper.mark_json, null),
      };
    });
  });

export const deleteMarkedPaper = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      const deleted = await sql<{ id: string }>`delete from papers
        where id = ${data.id} and user_id = ${context.userId}
        returning id`;
      if (!deleted.length) return { ok: false as const, error: "That marked paper was not found." };
      return { ok: true as const };
    });
  });

export const markPaper = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    title?: string;
    confirmed: boolean;
    paperImages: Img[];
    schemeImages: Img[];
    schemeText?: string;
    paperText?: string;
    paperId?: string;
    lastBatch?: boolean;
    batchIndex?: number;
    batchCount?: number;
  }) => input)
  .handler(async ({ context, data }) => {
    if (!data.confirmed) {
      return { ok: false as const, error: "Confirm you have the right to upload these materials." };
    }
    const paperImages = cleanImages(data.paperImages);
    const schemeImages = cleanImages(data.schemeImages);
    const schemeText = (data.schemeText ?? "").trim();
    const paperText = (data.paperText ?? "").trim();
    const lastBatch = data.lastBatch !== false;
    if (!data.paperId && !paperImages.length && !paperText) {
      return { ok: false as const, error: "Upload your completed paper (PDF or photos)." };
    }
    if (!data.paperId && !schemeImages.length && schemeText.length < 40) {
      return { ok: false as const, error: "Upload the official mark scheme as well." };
    }

    return withStudent(context.userId, displayNameFromContext(context), async (sql) => {
      if (!aiAvailable()) {
        return { ok: false as const, error: NEED_AI_KEY };
      }
      let id = data.paperId;
      let existingScheme: MarkSchemeParse | undefined;
      let existingPaper: PaperParse | null = null;
      let existingMark: PaperMark | null = null;

      if (id) {
        const rows = await sql<{
          id: string;
          scheme_json: string | null;
          parse_json: string | null;
          mark_json: string | null;
          status: string;
        }>`select id, scheme_json, parse_json, mark_json, status from papers
          where id = ${id} and user_id = ${context.userId}`;
        const row = rows[0];
        if (!row) return { ok: false as const, error: "That marking session was not found." };
        existingScheme = parseJson<MarkSchemeParse | null>(row.scheme_json, null) ?? undefined;
        existingPaper = parseJson<PaperParse | null>(row.parse_json, null);
        existingMark = parseJson<PaperMark | null>(row.mark_json, null);
      } else {
        id = newId();
        const title = (data.title?.trim() || "Marked paper").slice(0, 120);
        await sql`insert into papers (id, user_id, title, status)
          values (${id}, ${context.userId}, ${title}, 'marking')`;
      }

      const result = await markCompletedScript({
        paperImages,
        schemeImages,
        schemeText: schemeText || undefined,
        paperText: paperText || undefined,
        scheme: existingScheme,
        paper: existingPaper,
      });

      if (!result.ok) {
        const hasPartialMark = Boolean(existingMark?.questions.length);
        await sql`update papers set status = ${hasPartialMark ? "partial" : "draft"}, paper_notes = ${result.error}, updated_at = now()
          where id = ${id} and user_id = ${context.userId}`;
        return { ok: false as const, error: result.error, paperId: id, partial: hasPartialMark };
      }

      const scheme = result.scheme.questions.length ? result.scheme : existingScheme ?? result.scheme;
      const mark = existingMark ? mergePaperMarks([existingMark, result.mark], scheme) : mergePaperMarks([result.mark], scheme);
      const paper = result.paper ?? existingPaper;
      const board = paper?.board ?? "unspecified";
      const tier = paper?.tier ?? "unknown";
      const calculator = paper?.calculator ?? "unknown";

      await sql`update papers set
        status = ${lastBatch ? (result.partial ? "partial" : "marked") : "marking"},
        board = ${board},
        tier = ${tier},
        calculator = ${calculator},
        paper_notes = ${paper?.warnings.join("; ") ?? ""},
        ms_notes = ${scheme.warnings.join("; ")},
        parse_json = ${JSON.stringify(paper)},
        scheme_json = ${JSON.stringify(scheme)},
        mark_json = ${JSON.stringify(mark)},
        total_awarded = ${mark.total_awarded},
        total_available = ${mark.total_available},
        updated_at = now()
      where id = ${id} and user_id = ${context.userId}`;

      if (!lastBatch) {
        return {
          ok: true as const,
          paperId: id,
          awarded: mark.total_awarded,
          available: mark.total_available,
          partial: true as const,
        };
      }

      const qRows = (mark.questions.length ? mark.questions : scheme.questions.map((q) => ({
        question_ref: q.ref,
        awarded: 0,
        max_marks: q.total_marks,
        points: q.points.map((p) => ({
          code: p.code,
          awarded: false,
          evidence: "",
          reason: "",
          unsure: true,
        })),
        student_answer_summary: "",
        method_comment: "",
        follow_through_applied: false,
        mistakes: [],
        skill_ids: [],
        confidence: 0,
        needs_review: true,
        examiner_note: "",
      }))).map((q, i) => ({
        ...q,
        rowId: newId(),
        sort: i,
      }));

      for (const q of qRows) {
        const prompt =
          paper?.questions.find((p) => p.ref === q.question_ref)?.prompt ||
          scheme.questions.find((p) => p.ref === q.question_ref)?.notes ||
          `Question ${q.question_ref}`;
        const skillIds = (q.skill_ids ?? []).filter((sid) => SKILL_BY_ID[sid]);
        await sql`insert into paper_questions (id, paper_id, ref, prompt, marks, skill_ids, sort_order, notes)
          values (${q.rowId}, ${id}, ${q.question_ref}, ${prompt}, ${q.max_marks}, ${JSON.stringify(skillIds)}, ${q.sort}, ${q.examiner_note})`;

        for (const pt of q.points) {
          const src = scheme.questions
            .find((s) => s.ref === q.question_ref)
            ?.points.find((p) => p.code === pt.code);
          await sql`insert into paper_mark_points (
            id, paper_id, question_id, question_ref, code, description, marks,
            dependent_on, follow_through, or_equivalent, cao, alternative_group
          ) values (
            ${newId()}, ${id}, ${q.rowId}, ${q.question_ref}, ${pt.code},
            ${src?.description ?? pt.reason}, ${src?.marks ?? 1},
            ${src?.dependent_on ?? null}, ${src?.follow_through ?? false},
            ${src?.or_equivalent ?? false}, ${src?.cao ?? false}, ${src?.alternative_group ?? null}
          )`;
        }

        await sql`insert into paper_question_marks (
          id, paper_id, question_id, awarded, max_marks, points_json, feedback, confidence, needs_review, analysis_json
        ) values (
          ${newId()}, ${id}, ${q.rowId}, ${q.awarded}, ${q.max_marks}, ${JSON.stringify(q.points)},
          ${q.method_comment || q.examiner_note}, ${q.confidence}, ${q.needs_review}, ${JSON.stringify(q)}
        )`;

        const correct = q.max_marks > 0 ? q.awarded / q.max_marks >= 0.7 : false;
        if (skillIds.length) {
          await applyEvidence(sql, context.userId, skillIds, {
            correct,
            difficulty: 6,
            timeMs: 0,
            mistakeCount: q.mistakes.length,
          });
        }
        for (const m of q.mistakes) {
          await sql`insert into mistakes (
            id, user_id, attempt_id, question_id, skill_id, category,
            what_student_did, what_should, why_wrong, how_to_avoid, difficulty, corrected
          ) values (
            ${newId()}, ${context.userId}, ${q.rowId}, ${q.rowId}, ${m.skill_id && SKILL_BY_ID[m.skill_id] ? m.skill_id : null},
            ${m.category || "unknown"}, ${m.what_student_did}, ${m.what_should_happen}, ${m.why_wrong}, ${m.how_to_avoid}, 6, false
          )`;
        }
      }

      return {
        ok: true as const,
        paperId: id,
        awarded: mark.total_awarded,
        available: mark.total_available,
        partial: Boolean(result.partial),
      };
    });
  });
