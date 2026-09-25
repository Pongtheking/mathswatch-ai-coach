import type { RankedSkill } from "@/lib/engines/priority";

export type PlanItem = {
  id: string;
  title: string;
  minutes: number;
  skillId: string;
  kind: "fundamentals" | "practice" | "mistake-fix" | "retrieval" | "exam" | "new";
  detail: string;
};

export type DayPlan = {
  period: "today" | "week" | "next_week";
  minutes: number;
  rationale: string;
  items: PlanItem[];
};

export function buildTodayPlan(ranked: RankedSkill[], mistakeFocus?: RankedSkill | null): DayPlan {
  const top = ranked[0];
  const second = ranked[1];
  const maintain = ranked.find((r) => r.mastery !== null && r.mastery >= 78 && r.mastery < 92);
  const exam = ranked.find((r) => r.mastery !== null && r.mastery >= 60) ?? top;

  const items: PlanItem[] = [];
  if (top) {
    items.push({
      id: "fundamentals",
      title: `${top.name} fundamentals`,
      minutes: 10,
      skillId: top.skillId,
      kind: top.mastery === null || top.mastery < 50 ? "new" : "fundamentals",
      detail: top.whyItMatters,
    });
    items.push({
      id: "practice",
      title: `${top.name} questions`,
      minutes: 15,
      skillId: top.skillId,
      kind: "practice",
      detail: "Targeted questions at your current difficulty.",
    });
  }
  if (mistakeFocus) {
    items.push({
      id: "mistakes",
      title: `Fix repeated errors in ${mistakeFocus.name.toLowerCase()}`,
      minutes: 10,
      skillId: mistakeFocus.skillId,
      kind: "mistake-fix",
      detail: mistakeFocus.reason,
    });
  } else if (second) {
    items.push({
      id: "second",
      title: `${second.name} retrieval`,
      minutes: 10,
      skillId: second.skillId,
      kind: "retrieval",
      detail: second.whyItMatters,
    });
  }
  if (exam) {
    items.push({
      id: "exam",
      title: "Timed Grade 8/9 question",
      minutes: 10,
      skillId: exam.skillId,
      kind: "exam",
      detail: "Exam technique under light time pressure.",
    });
  }
  if (maintain && !items.some((i) => i.skillId === maintain.skillId)) {
    items[items.length - 1] = {
      id: "maintain",
      title: `Keep ${maintain.name.toLowerCase()} sharp`,
      minutes: 8,
      skillId: maintain.skillId,
      kind: "retrieval",
      detail: "Spaced retrieval so a strong skill does not fade.",
    };
  }

  const minutes = items.reduce((a, i) => a + i.minutes, 0);
  const rationale = top
    ? `Today is built around ${top.name.toLowerCase()} because ${top.reason}. The rest of the session protects retrieval and exam technique.`
    : "Take a short diagnostic so the coach can see where you actually stand.";

  return { period: "today", minutes, rationale, items };
}

export function buildWeekPlan(ranked: RankedSkill[]): DayPlan {
  const focus = ranked.slice(0, 5);
  const items: PlanItem[] = focus.map((r, i) => ({
    id: `w-${r.skillId}`,
    title: r.name,
    minutes: i === 0 ? 50 : 35,
    skillId: r.skillId,
    kind: r.mastery !== null && r.mastery < 50 ? "new" : "practice",
    detail: r.whyItMatters,
  }));
  items.push({
    id: "w-exam",
    title: "Mini exam paper",
    minutes: 40,
    skillId: focus[0]?.skillId ?? "alg.solving-linear",
    kind: "exam",
    detail: "Timed mixed questions to check transfer.",
  });
  return {
    period: "week",
    minutes: items.reduce((a, i) => a + i.minutes, 0),
    rationale:
      "This week balances your biggest blockers with retrieval of stronger topics and one timed paper.",
    items,
  };
}

export function buildNextWeekPlan(ranked: RankedSkill[]): DayPlan {
  const next = ranked.slice(1, 6);
  const items = next.map((r) => ({
    id: `n-${r.skillId}`,
    title: r.name,
    minutes: 30,
    skillId: r.skillId,
    kind: "practice" as const,
    detail: r.whyItMatters,
  }));
  return {
    period: "next_week",
    minutes: items.reduce((a, i) => a + i.minutes, 0),
    rationale:
      "Next week shifts toward the next layer of blockers once this week's focus has had time to settle.",
    items,
  };
}
