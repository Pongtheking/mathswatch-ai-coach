import { SKILLS } from "@/lib/curriculum/data";
import { chatJson, imageParts, type ChatMessage } from "@/lib/ai/client";
import {
  markSchemeParseSchema,
  paperMarkSchema,
  paperParseSchema,
  type MarkSchemeParse,
  type PaperMark,
  type PaperParse,
} from "@/lib/ai/schemas";

const SKILL_CATALOGUE = SKILLS.map(
  (s) => `${s.id} | ${s.name} | ${s.category} | grades ${s.gradeMin}-${s.gradeMax}`,
).join("\n");

const EXAMINER = `You are a senior GCSE Maths examiner (AQA / Edexcel / OCR). You mark with the discipline of a trained assistant examiner.

THE MARK SCHEME IS THE ONLY SOURCE OF TRUTH.
- Do not invent answers, extra methods, or extra marks.
- Do not withhold a mark the scheme awards (including ft, oe, and listed alternatives).
- If working is unreadable or ambiguous, set unsure=true and needs_review=true instead of guessing.

GCSE mark types:
- M = method. Award if the correct method is seen, even if later arithmetic fails.
- A = accuracy. Dependent on the relevant M unless the scheme says otherwise.
- B = independent mark.
- C = communication / conclusion.
- P = process (newer papers).
- ft / follow through = award if the method is applied correctly to the student's own previous value.
- oe = or equivalent.
- cao = correct answer only.
- dep = dependent.
- SC = special case. Award only if the scheme lists it.

Further rules:
1. Never penalise the same error twice. Use follow-through when the scheme allows it.
2. Award method marks for a valid method even when the final answer is wrong.
3. If the student uses a correct alternative listed on the scheme (or clearly oe), award it.
4. Total awarded for a question cannot exceed that question's max marks.
5. Quote brief evidence from the student's working for every mark point.
6. Mathematical correctness matters more than sounding confident. If you cannot see a mark, do not award it.
7. Never claim this is an official exam-board grade.`;

export async function parsePaperImages(input: {
  images: Array<{ mime: string; base64: string }>;
  typedText?: string;
}): Promise<{ ok: true; data: PaperParse } | { ok: false; error: string }> {
  if (!input.images.length && !input.typedText?.trim()) {
    return { ok: false, error: "Add photos of the paper, or type the questions." };
  }
  const content: ChatMessage["content"] = [
    {
      type: "text",
      text: `Extract every question and part from this GCSE Maths paper. Preserve wording. Do NOT solve anything.

Return JSON:
{
  "title": "",
  "board": "AQA|Edexcel|OCR|unspecified",
  "tier": "foundation|higher|unknown",
  "calculator": "calculator|non-calculator|unknown",
  "questions": [
    { "ref": "1a", "prompt": "full text of this part", "marks": 2, "skill_ids": ["from catalogue"], "notes": "" }
  ],
  "warnings": [],
  "confidence": 0.0
}

Use refs like 1, 1a, 1b, 2. Keep parts separate when they have their own marks.
Skill catalogue:\n${SKILL_CATALOGUE}
${input.typedText?.trim() ? `\nTyped / pasted paper text:\n${input.typedText.trim()}` : ""}`,
    },
    ...imageParts(input.images),
  ];
  return chatJson(paperParseSchema, [
    { role: "system", content: EXAMINER },
    { role: "user", content },
  ], { maxTokens: 4500, temperature: 0, quality: true });
}

export async function parseMarkScheme(input: {
  images: Array<{ mime: string; base64: string }>;
  typedText?: string;
  questionRefs: string[];
}): Promise<{ ok: true; data: MarkSchemeParse } | { ok: false; error: string }> {
  if (!input.images.length && !input.typedText?.trim()) {
    return { ok: false, error: "Add the mark scheme photos or paste the mark scheme text." };
  }
  const content: ChatMessage["content"] = [
    {
      type: "text",
      text: `Extract the OFFICIAL mark scheme. Do not rewrite mathematics. Preserve M1/A1/B1, ft, oe, cao, dep, SC, and alternative methods.

Question refs on the paper: ${input.questionRefs.join(", ") || "(not yet parsed)"}

Return JSON:
{
  "questions": [
    {
      "ref": "1a",
      "total_marks": 3,
      "notes": "any examiner notes / extra info",
      "points": [
        {
          "id": "1a-1",
          "question_ref": "1a",
          "code": "M1",
          "description": "exact mark-scheme wording",
          "marks": 1,
          "dependent_on": null,
          "follow_through": false,
          "or_equivalent": true,
          "cao": false,
          "alternative_group": null
        }
      ]
    }
  ],
  "general_notes": [],
  "warnings": [],
  "confidence": 0.0
}

Give every point a stable unique id made from its question reference and position (for example "1a-1", "1a-2"). If two methods are alternatives, give them the same alternative_group (e.g. "altA").
${input.typedText?.trim() ? `\nPasted mark scheme text:\n${input.typedText.trim().slice(0, 100000)}` : ""}`,
    },
    ...imageParts(input.images),
  ];
  return chatJson(markSchemeParseSchema, [
    { role: "system", content: EXAMINER },
    { role: "user", content },
  ], { maxTokens: 5000, temperature: 0, quality: true });
}

export async function markAgainstScheme(input: {
  questions: Array<{ ref: string; prompt: string; marks: number }>;
  scheme: MarkSchemeParse;
  answerImages: Array<{ mime: string; base64: string }>;
  schemeImages?: Array<{ mime: string; base64: string }>;
  typedAnswers?: string;
}): Promise<{ ok: true; data: PaperMark } | { ok: false; error: string }> {
  if (!input.answerImages.length && !input.typedAnswers?.trim()) {
    return { ok: false, error: "Add photos or typed working of the completed paper." };
  }
  const schemeText = JSON.stringify(input.scheme);
  const paperText = input.questions
    .map((q) => `[${q.ref}] (${q.marks} marks) ${q.prompt}`)
    .join("\n\n");

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: `Mark this student's completed script STRICTLY against the official mark scheme.

PAPER QUESTIONS:
${paperText || "(Read questions from the student script and/or mark scheme pages.)"}

PARSED MARK SCHEME (source of truth — do not invent extra marks):
${schemeText}

${input.typedAnswers?.trim() ? `TYPED WORKING / ANSWERS:\n${input.typedAnswers.trim().slice(0, 40000)}` : "Working is in the student script images."}

Return JSON:
{
  "questions": [
    {
      "question_ref": "1a",
      "awarded": 0,
      "max_marks": 0,
      "points": [
        { "point_id": "1a-1", "code": "M1", "awarded": true, "evidence": "quote from script", "reason": "why awarded/not", "unsure": false }
      ],
      "student_answer_summary": "",
      "method_comment": "",
      "follow_through_applied": false,
      "mistakes": [
        {
          "category": "algebra error",
          "what_student_did": "",
          "what_should_happen": "",
          "why_wrong": "",
          "how_to_avoid": "",
          "skill_id": null
        }
      ],
      "skill_ids": [],
      "confidence": 0.0,
      "needs_review": false,
      "examiner_note": ""
    }
  ],
  "total_awarded": 0,
  "total_available": 0,
  "overall_comment": "",
  "method_vs_accuracy": "how many method marks vs accuracy marks were lost",
  "biggest_lost_marks": [],
  "warnings": []
}

Before returning JSON, carefully check each visible question twice: first identify the student's method and answer, then test every official point. Award valid method marks even where a later arithmetic error happens; apply ft/oe where the scheme permits. Every mark point on the scheme must appear for questions that are visible on these pages. Copy each point_id exactly from the parsed mark scheme; do not use a label such as M1/A1 by itself because labels can repeat. Use the question reference and maximum from the supplied scheme exactly; never make up, change, or combine a question's maximum. Awarded totals must match the sum of awarded points (counting alternative groups once).
If a question is clearly not on these pages, omit it rather than marking it zero.
If later images are the official mark scheme pages, use them only as the scheme — never as the student's work.`,
    },
  ];

  if (input.schemeImages?.length) {
    content.push({ type: "text", text: "OFFICIAL MARK SCHEME PAGES follow this line." });
    content.push(...imageParts(input.schemeImages));
  }
  content.push({ type: "text", text: "STUDENT SCRIPT PAGES follow this line. Mark only what is written here." });
  content.push(...imageParts(input.answerImages));

  return chatJson(paperMarkSchema, [
    { role: "system", content: EXAMINER },
    { role: "user", content },
  ], { maxTokens: 5000, temperature: 0, quality: true });
}

export async function markCompletedScript(input: {
  paperImages: Array<{ mime: string; base64: string }>;
  schemeImages: Array<{ mime: string; base64: string }>;
  schemeText?: string;
  paperText?: string;
  scheme?: MarkSchemeParse;
  paper?: PaperParse | null;
}): Promise<
  | {
      ok: true;
      scheme: MarkSchemeParse;
      paper: PaperParse | null;
      mark: PaperMark;
      partial: boolean;
    }
  | { ok: false; error: string }
> {
  const richSchemeText = Boolean(input.schemeText && input.schemeText.trim().length > 700);
  const schemeImages = richSchemeText ? input.schemeImages.slice(0, 4) : input.schemeImages;

  let scheme: MarkSchemeParse;
  let paper: PaperParse | null = input.paper ?? null;

  if (input.scheme && input.scheme.questions.length) {
    scheme = input.scheme;
  } else {
    const schemeRes = await parseSchemeInBatches({
      images: schemeImages,
      typedText: input.schemeText,
    });
    scheme = schemeRes.ok
      ? schemeRes.data
      : { questions: [], general_notes: [], warnings: [schemeRes.error], confidence: 0 };
  }

  // The question paper provides a second official statement of each question's
  // maximum. It is used only to repair an incomplete scheme extraction, never
  // to invent mark points or answers.
  if (!paper) {
    const parsed = await parsePaperImages({
      images: input.paperImages.slice(0, 10),
      typedText: input.paperText,
    });
    if (parsed.ok) paper = parsed.data;
  }

  scheme = withPointIds(reconcileSchemeWithPaper(scheme, paper));

  const questions =
    scheme.questions.length > 0
      ? scheme.questions.map((q) => ({
          ref: q.ref,
          prompt: q.notes || `Question ${q.ref}`,
          marks: q.total_marks,
        }))
      : paper?.questions.map((q) => ({
          ref: q.ref,
          prompt: q.prompt,
          marks: q.marks,
        })) ?? [];

  const batches = chunk(input.paperImages, 3, 1);
  const imageBatches = batches.length ? batches : [[]];
  const marks: PaperMark[] = [];
  let incompleteWarning = "";

  for (let i = 0; i < imageBatches.length; i++) {
    const markRes = await markAgainstScheme({
      questions,
      scheme,
      answerImages: imageBatches[i],
      schemeImages: i === 0 && scheme.confidence < 0.55 ? schemeImages.slice(0, 4) : undefined,
      typedAnswers: i === 0 ? input.paperText : undefined,
    });
    if (!markRes.ok) {
      if (marks.length) {
        incompleteWarning = `Only the earlier pages were marked: ${markRes.error}`;
        break;
      }
      return markRes;
    }
    marks.push(normaliseTotals(markRes.data, scheme));
  }

  if (!marks.length) {
    return { ok: false, error: "Could not mark this script. Retry with clearer pages." };
  }

  const mark = mergePaperMarks(marks, scheme);
  if (incompleteWarning) mark.warnings = [...mark.warnings, incompleteWarning];
  return { ok: true, scheme, paper, mark, partial: Boolean(incompleteWarning) };
}

function chunk<T>(items: T[], size: number, overlap: number): T[][] {
  if (items.length <= size) return items.length ? [items] : [];
  const out: T[][] = [];
  let i = 0;
  while (i < items.length) {
    const end = Math.min(items.length, i + size);
    out.push(items.slice(i, end));
    if (end >= items.length) break;
    i = Math.max(i + 1, end - overlap);
  }
  return out;
}

async function parseSchemeInBatches(input: {
  images: Array<{ mime: string; base64: string }>;
  typedText?: string;
}): Promise<{ ok: true; data: MarkSchemeParse } | { ok: false; error: string }> {
  const batches = chunk(input.images, 8, 1);
  if (!batches.length) {
    return parseMarkScheme({ images: [], typedText: input.typedText, questionRefs: [] });
  }
  const parts: MarkSchemeParse[] = [];
  let lastError = "";
  for (let i = 0; i < batches.length; i++) {
    const res = await parseMarkScheme({
      images: batches[i],
      typedText: i === 0 ? input.typedText : undefined,
      questionRefs: [],
    });
    if (res.ok) parts.push(res.data);
    else lastError = res.error;
  }
  if (!parts.length) return { ok: false, error: lastError || "Could not read the mark scheme." };
  return { ok: true, data: mergeSchemes(parts) };
}

function mergeSchemes(parts: MarkSchemeParse[]): MarkSchemeParse {
  const byRef = new Map<string, MarkSchemeParse["questions"][number]>();
  const notes: string[] = [];
  const warnings: string[] = [];
  let confidence = 0;
  for (const part of parts) {
    notes.push(...part.general_notes);
    warnings.push(...part.warnings);
    confidence = Math.max(confidence, part.confidence);
    for (const q of part.questions) {
      const prev = byRef.get(q.ref);
      if (!prev || q.points.length > prev.points.length) byRef.set(q.ref, q);
    }
  }
  const questions = [...byRef.values()].sort((a, b) =>
    a.ref.localeCompare(b.ref, undefined, { numeric: true }),
  );
  return withPointIds({
    questions,
    general_notes: unique(notes),
    warnings: unique(warnings),
    confidence,
  });
}

export function mergePaperMarks(parts: PaperMark[], scheme?: MarkSchemeParse): PaperMark {
  const byRef = new Map<string, PaperMark["questions"][number]>();
  const warnings: string[] = [];
  const lost: string[] = [];
  const comments: string[] = [];
  const methods: string[] = [];
  for (const part of parts) {
    warnings.push(...part.warnings);
    lost.push(...part.biggest_lost_marks);
    if (part.overall_comment.trim()) comments.push(part.overall_comment.trim());
    if (part.method_vs_accuracy.trim()) methods.push(part.method_vs_accuracy.trim());
    for (const q of part.questions) {
      if (!q.question_ref.trim()) continue;
      const prev = byRef.get(q.question_ref);
      if (!prev || questionWeight(q) >= questionWeight(prev)) byRef.set(q.question_ref, q);
    }
  }
  const expected = schemeQuestions(scheme);
  const missing: string[] = [];
  for (const [ref, source] of expected) {
    if (!byRef.has(ref)) {
      missing.push(ref);
      byRef.set(ref, {
        question_ref: ref,
        awarded: 0,
        max_marks: source.max_marks,
        points: source.points.map((point) => ({
          point_id: point.id,
          code: point.code,
          awarded: false,
          evidence: "",
          reason: "This question was not read reliably enough to award marks.",
          unsure: true,
        })),
        student_answer_summary: "",
        method_comment: "",
        follow_through_applied: false,
        mistakes: [],
        skill_ids: [],
        confidence: 0,
        needs_review: true,
        examiner_note: "Not read reliably — review this question before relying on the total.",
      });
    }
  }
  const questions = [...byRef.values()].sort((a, b) =>
    a.question_ref.localeCompare(b.question_ref, undefined, { numeric: true }),
  );
  return addFeedback(normaliseTotals({
    questions,
    total_awarded: 0,
    total_available: 0,
    overall_comment: unique(comments).join(" "),
    method_vs_accuracy: methods[0] ?? "",
    biggest_lost_marks: unique(lost).slice(0, 10),
    warnings: unique([
      ...warnings,
      ...(missing.length
        ? [`${missing.length} question${missing.length === 1 ? " was" : "s were"} not read reliably and ${missing.length === 1 ? "is" : "are"} marked for review: ${missing.join(", ")}.`]
        : []),
    ]),
  }, scheme));
}

function reconcileSchemeWithPaper(scheme: MarkSchemeParse, paper: PaperParse | null): MarkSchemeParse {
  if (!paper?.questions.length) return scheme;
  const schemeTotal = scheme.questions.reduce((sum, question) => sum + question.total_marks, 0);
  const paperTotal = paper.questions.reduce((sum, question) => sum + question.marks, 0);
  if (paperTotal <= schemeTotal) return scheme;

  const paperByRef = new Map(paper.questions.map((question) => [question.ref.trim(), question]));
  const used = new Set<string>();
  const questions = scheme.questions.map((question) => {
    const paperQuestion = paperByRef.get(question.ref.trim());
    if (!paperQuestion || paperQuestion.marks <= 0) return question;
    used.add(paperQuestion.ref.trim());
    return { ...question, total_marks: paperQuestion.marks };
  });
  for (const question of paper.questions) {
    const ref = question.ref.trim();
    if (!ref || used.has(ref) || scheme.questions.some((item) => item.ref.trim() === ref)) continue;
    questions.push({ ref, total_marks: question.marks, notes: question.prompt, points: [] });
  }
  return {
    ...scheme,
    questions,
    warnings: unique([
      ...scheme.warnings,
      `The mark-scheme extraction totalled ${schemeTotal}, but the question paper totalled ${paperTotal}. Question maxima were restored from the paper; questions without a readable scheme are flagged for review.`,
    ]),
  };
}

function withPointIds(scheme: MarkSchemeParse): MarkSchemeParse {
  return {
    ...scheme,
    questions: scheme.questions.map((question) => ({
      ...question,
      points: question.points.map((point, index) => ({
        ...point,
        id: point.id.trim() || `${question.ref.trim()}-${index + 1}`,
      })),
    })),
  };
}

function questionWeight(q: PaperMark["questions"][number]): number {
  const evidence = q.points.filter((p) => p.evidence.trim()).length;
  const summary = q.student_answer_summary.trim() ? 2 : 0;
  return evidence * 3 + summary + q.confidence + (q.awarded > 0 ? 1 : 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function schemeQuestions(scheme?: MarkSchemeParse) {
  const expected = new Map<string, { max_marks: number; points: MarkSchemeParse["questions"][number]["points"] }>();
  for (const question of scheme?.questions ?? []) {
    const ref = question.ref.trim();
    if (!ref) continue;
    const pointMarks = question.points.reduce((sum, point) => sum + point.marks, 0);
    expected.set(ref, {
      max_marks: question.total_marks > 0 ? question.total_marks : pointMarks,
      points: question.points,
    });
  }
  return expected;
}

function normaliseTotals(mark: PaperMark, scheme?: MarkSchemeParse): PaperMark {
  const expected = schemeQuestions(scheme);
  const questions = mark.questions.map((q) => {
    const official = expected.get(q.question_ref.trim());
    const officialPoints = new Map((official?.points ?? []).map((point) => [point.id, point]));
    const pointsByCode = new Map<string, MarkSchemeParse["questions"][number]["points"]>();
    for (const point of official?.points ?? []) {
      const matches = pointsByCode.get(point.code) ?? [];
      matches.push(point);
      pointsByCode.set(point.code, matches);
    }
    const usedPointIds = new Set<string>();
    const awardedGroups = new Set<string>();
    const fromPoints = q.points.reduce((sum, point) => {
      if (!point.awarded) return sum;
      const source = point.point_id
        ? officialPoints.get(point.point_id)
        : pointsByCode.get(point.code)?.find((candidate) => !usedPointIds.has(candidate.id));
      if (!source) return sum;
      if (usedPointIds.has(source.id)) return sum;
      usedPointIds.add(source.id);
      const group = source.alternative_group;
      if (group && awardedGroups.has(group)) return sum;
      if (group) awardedGroups.add(group);
      return sum + source.marks;
    }, 0);
    const max = official?.max_marks || q.max_marks || q.points.length || q.awarded;
    const awarded = official && q.points.length ? fromPoints : q.awarded;
    return { ...q, awarded: Math.min(Math.max(0, awarded), max), max_marks: max };
  });
  const total_awarded = questions.reduce((s, q) => s + q.awarded, 0);
  const total_available = questions.reduce((s, q) => s + q.max_marks, 0);
  return {
    ...mark,
    questions,
    total_awarded: mark.questions.length ? total_awarded : mark.total_awarded,
    total_available: mark.questions.length ? total_available : mark.total_available,
  };
}

function addFeedback(mark: PaperMark): PaperMark {
  const questions = mark.questions.map((question) => {
    const points = question.points.map((point) => ({
      ...point,
      reason: point.reason.trim() || (point.awarded ? "Awarded from the method or answer shown." : "This mark point was not evidenced in the submitted working."),
    }));
    const feedback = question.method_comment.trim() || question.examiner_note.trim() || (() => {
      if (question.needs_review) return "This answer could not be read reliably enough to mark with confidence. Check the work against the listed mark points.";
      const missed = points.find((point) => !point.awarded);
      if (missed) return `You earned ${question.awarded}/${question.max_marks}. Focus next on: ${missed.reason}`;
      return `You earned all ${question.max_marks} marks on this question.`;
    })();
    return { ...question, points, method_comment: feedback };
  });
  const totalAwarded = questions.reduce((sum, question) => sum + question.awarded, 0);
  const totalAvailable = questions.reduce((sum, question) => sum + question.max_marks, 0);
  return {
    ...mark,
    questions,
    overall_comment: mark.overall_comment.trim() || `You scored ${totalAwarded}/${totalAvailable}. Use the question feedback and mark points below to target your next revision session.`,
  };
}

