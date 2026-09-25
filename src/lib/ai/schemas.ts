import { z } from "zod";
import { MISTAKE_CATEGORIES } from "@/lib/utils";

export const questionAnalysisSchema = z.object({
  question_text: z.string(),
  prompt_latex: z.string().nullish(),
  topic: z.string().default("Algebra"),
  subtopic: z.string().default(""),
  skill_ids: z.array(z.string()).catch([]),
  difficulty: z.coerce.number().min(1).max(9).catch(5),
  estimated_grade: z.coerce.number().min(1).max(9).catch(5),
  question_type: z.string().default("structured"),
  marks: z.number().nullish(),
  command_words: z.array(z.string()).catch([]),
  prerequisites: z.array(z.string()).catch([]),
  calculator: z.boolean().nullish(),
  notes: z.string().catch(""),
  confidence: z.coerce.number().min(0).max(1).catch(0.7),
  needs_confirmation: z.boolean().catch(true),
});
export type QuestionAnalysis = z.infer<typeof questionAnalysisSchema>;

export const workingAnalysisSchema = z.object({
  is_correct: z.boolean(),
  final_answer: z.string().default(""),
  expected_answer: z.string().nullable().optional(),
  earliest_error_step: z.number().nullable().optional(),
  steps: z
    .array(
      z.object({
        n: z.number(),
        text: z.string(),
        ok: z.boolean(),
        note: z.string().default(""),
      }),
    )
    .default([]),
  mistakes: z
    .array(
      z.object({
        category: z.string(),
        skill_id: z.string().nullable().optional(),
        what_student_did: z.string(),
        what_should_happen: z.string(),
        why_wrong: z.string(),
        how_to_avoid: z.string(),
      }),
    )
    .default([]),
  feedback: z.string(),
  praise: z.string().default(""),
});
export type WorkingAnalysis = z.infer<typeof workingAnalysisSchema>;

export const tutorSchema = z.object({
  content: z.string(),
  reveals_answer: z.boolean().default(false),
});
export type TutorReply = z.infer<typeof tutorSchema>;

export const generatedQuestionSchema = z.object({
  prompt: z.string(),
  marks: z.number().min(1).max(8),
  answer: z.string(),
  worked_solution: z.string(),
  skill_ids: z.array(z.string()),
  difficulty: z.number().min(1).max(9),
  calculator: z.boolean(),
  question_type: z.string(),
  common_mistakes: z.array(z.string()).default([]),
  valid: z.boolean().default(true),
  validation_notes: z.string().default(""),
});
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export const weeklyReviewSchema = z.object({
  headline: z.string(),
  accuracy_note: z.string(),
  biggest_improvement: z.string(),
  biggest_weakness: z.string(),
  repeated_mistake: z.string(),
  next_week_priorities: z.array(z.string()),
  coach_note: z.string(),
});

export const paperQuestionParseSchema = z.object({
  ref: z.string(),
  prompt: z.string(),
  marks: z.coerce.number().min(0).max(20).catch(1),
  skill_ids: z.array(z.string()).catch([]),
  notes: z.string().catch(""),
});

export const paperParseSchema = z.object({
  title: z.string().default("Exam paper"),
  board: z.string().default("unspecified"),
  tier: z.string().default("unknown"),
  calculator: z.string().default("unknown"),
  questions: z.array(paperQuestionParseSchema).default([]),
  warnings: z.array(z.string()).catch([]),
  confidence: z.coerce.number().min(0).max(1).catch(0.6),
});
export type PaperParse = z.infer<typeof paperParseSchema>;

export const markPointParseSchema = z.object({
  id: z.string().catch(""),
  question_ref: z.string(),
  code: z.string(),
  description: z.string(),
  marks: z.coerce.number().min(0).max(6).catch(1),
  dependent_on: z.string().nullish(),
  follow_through: z.boolean().catch(false),
  or_equivalent: z.boolean().catch(false),
  cao: z.boolean().catch(false),
  alternative_group: z.string().nullish(),
});

export const markSchemeParseSchema = z.object({
  questions: z
    .array(
      z.object({
        ref: z.string(),
        total_marks: z.coerce.number().min(0).max(20).catch(0),
        notes: z.string().catch(""),
        points: z.array(markPointParseSchema).default([]),
      }),
    )
    .default([]),
  general_notes: z.array(z.string()).catch([]),
  warnings: z.array(z.string()).catch([]),
  confidence: z.coerce.number().min(0).max(1).catch(0.6),
});
export type MarkSchemeParse = z.infer<typeof markSchemeParseSchema>;

export const markedPointSchema = z.object({
  point_id: z.string().catch(""),
  code: z.string(),
  awarded: z.boolean(),
  evidence: z.string().default(""),
  reason: z.string().default(""),
  unsure: z.boolean().catch(false),
});

export const questionMarkResultSchema = z.object({
  question_ref: z.string(),
  awarded: z.coerce.number().min(0).catch(0),
  max_marks: z.coerce.number().min(0).catch(0),
  points: z.array(markedPointSchema).default([]),
  student_answer_summary: z.string().default(""),
  method_comment: z.string().default(""),
  follow_through_applied: z.boolean().catch(false),
  mistakes: z
    .array(
      z.object({
        category: z.string(),
        what_student_did: z.string(),
        what_should_happen: z.string(),
        why_wrong: z.string(),
        how_to_avoid: z.string(),
        skill_id: z.string().nullable().optional(),
      }),
    )
    .default([]),
  skill_ids: z.array(z.string()).catch([]),
  confidence: z.coerce.number().min(0).max(1).catch(0.6),
  needs_review: z.boolean().catch(false),
  examiner_note: z.string().default(""),
});

export const paperMarkSchema = z.object({
  questions: z.array(questionMarkResultSchema).default([]),
  total_awarded: z.coerce.number().min(0).catch(0),
  total_available: z.coerce.number().min(0).catch(0),
  overall_comment: z.string().default(""),
  method_vs_accuracy: z.string().default(""),
  biggest_lost_marks: z.array(z.string()).catch([]),
  warnings: z.array(z.string()).catch([]),
});
export type PaperMark = z.infer<typeof paperMarkSchema>;

export const MISTAKE_SET = new Set<string>(MISTAKE_CATEGORIES);
