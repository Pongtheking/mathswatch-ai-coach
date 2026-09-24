import { SKILLS } from "@/lib/curriculum/data";
import { chatJson, dataUrlFromBase64, type ChatMessage } from "@/lib/ai/client";
import {
  generatedQuestionSchema,
  questionAnalysisSchema,
  tutorSchema,
  weeklyReviewSchema,
  workingAnalysisSchema,
  type GeneratedQuestion,
  type QuestionAnalysis,
  type TutorReply,
  type WorkingAnalysis,
} from "@/lib/ai/schemas";

const SKILL_CATALOGUE = SKILLS.map(
  (s) => `${s.id} | ${s.name} | ${s.category} | grades ${s.gradeMin}-${s.gradeMax}`,
).join("\n");

const COACH =
  "You are a serious GCSE Maths coach helping a student towards Grade 9. Tone: direct, encouraging, disciplined, honest, practical. Never shame the student. Use GCSE language, not university language. Mathematical correctness matters more than sounding confident. If uncertain, say so. Never claim to predict an official GCSE grade.";

export async function analyzeQuestionImage(input: {
  mime: string;
  base64: string;
}): Promise<{ ok: true; data: QuestionAnalysis } | { ok: false; error: string }> {
  const url = dataUrlFromBase64(input.mime, input.base64);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${COACH}

Read a MathsWatch / GCSE Maths question from an image. Extract the question faithfully. Do NOT solve it and do NOT reveal the answer.

Return JSON:
{
  "question_text": "full question including all parts",
  "prompt_latex": "optional latex",
  "topic": "",
  "subtopic": "",
  "skill_ids": ["ids from the catalogue"],
  "difficulty": 1-9,
  "estimated_grade": 1-9,
  "question_type": "short|structured|multi-step|proof",
  "marks": null or number,
  "command_words": [],
  "prerequisites": [],
  "calculator": true/false/null,
  "notes": "anything unclear that the student should confirm",
  "confidence": 0-1,
  "needs_confirmation": true
}

Skill catalogue:
${SKILL_CATALOGUE}

If the image is unreadable, still return JSON with question_text explaining that and confidence 0.`,
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Analyse this GCSE Maths question image. Do not give the answer." },
        { type: "image_url", image_url: { url } },
      ],
    },
  ];
  return chatJson(questionAnalysisSchema, messages, { maxTokens: 1600 });
}

export async function analyzeTypedQuestion(text: string) {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${COACH}

Identify topic and skills for a typed GCSE question. Do NOT solve it.
Return the same JSON schema as image analysis.
Skills:\n${SKILL_CATALOGUE}`,
    },
    { role: "user", content: text },
  ];
  return chatJson(questionAnalysisSchema, messages, { maxTokens: 1200 });
}

export async function tutorOnQuestion(input: {
  question: string;
  mode: "explain" | "hint" | "stronger_hint" | "method" | "solution";
  previous?: string;
}): Promise<{ ok: true; data: TutorReply } | { ok: false; error: string }> {
  const policy = {
    explain:
      "Explain the idea and what the command word is asking. Do NOT give the method steps or the answer.",
    hint: "Give a small conceptual hint only. Do not name the full method or any numbers of the answer.",
    stronger_hint:
      "Give a method-selection hint: which technique to use and why. Do not perform the first algebraic step.",
    method:
      "Show the method outline, step by step, but stop before the final numerical/algebraic answer if possible.",
    solution: "Give a full GCSE-style worked solution with the final answer.",
  }[input.mode];

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${COACH}

${policy}

Return JSON { "content": "markdown, GCSE level", "reveals_answer": boolean }.`,
    },
    {
      role: "user",
      content: `Question:\n${input.question}\n\nMode: ${input.mode}\n${input.previous ? `Student so far:\n${input.previous}` : ""}`,
    },
  ];
  return chatJson(tutorSchema, messages, { maxTokens: 1200 });
}

export async function analyzeWorking(input: {
  question: string;
  expectedAnswer?: string | null;
  workingText?: string;
  workingImage?: { mime: string; base64: string };
  skillIds: string[];
}): Promise<{ ok: true; data: WorkingAnalysis } | { ok: false; error: string }> {
  const userContent: ChatMessage["content"] = [];
  if (typeof userContent !== "string") {
    userContent.push({
      type: "text",
      text: `Question:\n${input.question}\n\nExpected answer (may be blank): ${input.expectedAnswer ?? "(unknown)"}\nSkills: ${input.skillIds.join(", ")}\n\nStudent working (typed):\n${input.workingText || "(none)"}\n\nIdentify the EARLIEST incorrect step. Do not only mark the final answer.`,
    });
    if (input.workingImage) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: dataUrlFromBase64(input.workingImage.mime, input.workingImage.base64),
        },
      });
    }
  }
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${COACH}

Analyse GCSE Maths working. Return JSON:
{
  "is_correct": boolean,
  "final_answer": "",
  "expected_answer": "",
  "earliest_error_step": number or null,
  "steps": [{"n":1,"text":"","ok":true,"note":""}],
  "mistakes": [{
    "category": one of concept gap|method selection|algebra error|arithmetic error|sign error|formula error|units|rounding|misreading|exam technique|careless error|graph interpretation|notation|unknown,
    "skill_id": "from catalogue or null",
    "what_student_did": "",
    "what_should_happen": "",
    "why_wrong": "",
    "how_to_avoid": ""
  }],
  "feedback": "coach paragraph",
  "praise": "what they did right"
}

If working is missing, say so and set is_correct false.`,
    },
    { role: "user", content: userContent },
  ];
  return chatJson(workingAnalysisSchema, messages, { maxTokens: 1800 });
}

export async function generateQuestion(input: {
  skillId: string;
  skillName: string;
  difficulty: number;
  calculator: boolean;
}): Promise<{ ok: true; data: GeneratedQuestion } | { ok: false; error: string }> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${COACH}

Generate ONE original GCSE Maths question. It must be mathematically valid. Solve it yourself and put the correct answer in "answer". If you cannot guarantee validity, set valid=false.

Return JSON matching:
prompt, marks, answer, worked_solution, skill_ids, difficulty, calculator, question_type, common_mistakes, valid, validation_notes.

Do not copy a famous textbook question word-for-word.`,
    },
    {
      role: "user",
      content: `Skill: ${input.skillId} (${input.skillName}). Target grade/difficulty: ${input.difficulty}. Calculator allowed: ${input.calculator}.`,
    },
  ];
  const result = await chatJson(generatedQuestionSchema, messages, { maxTokens: 1400 });
  if (!result.ok) return result;
  if (!result.data.valid || !result.data.answer || !result.data.prompt) {
    return { ok: false, error: result.data.validation_notes || "Generated question failed validation." };
  }
  return result;
}

export async function writeWeeklyReview(stats: unknown) {
  return chatJson(weeklyReviewSchema, [
    {
      role: "system",
      content: `${COACH} Write a weekly review from stats JSON. Return JSON with headline, accuracy_note, biggest_improvement, biggest_weakness, repeated_mistake, next_week_priorities (array of strings), coach_note. Be specific and practical. Never shame.`,
    },
    { role: "user", content: JSON.stringify(stats) },
  ]);
}
