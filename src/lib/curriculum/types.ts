export type Tier = "foundation" | "higher" | "both";
export type SkillDef = {
  id: string; name: string; category: string; subtopic: string; topicId: string;
  tier: Tier; difficulty: number; relevance: number; gradeMin: number; gradeMax: number;
  examFreq: number; prereq: string[]; related: string[]; mistakes: string[];
};
export type TopicDef = { id: string; name: string; category: string; description: string };
export type BankQuestion = {
  id: string; prompt: string; promptLatex?: string; marks: number; answer: string; solution: string;
  skillIds: string[]; topicId: string; difficulty: number; calculator: boolean; type: string;
  commandWords: string[]; commonMistakes: string[];
};
