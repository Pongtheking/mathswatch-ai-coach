import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function newId(): string {
  return crypto.randomUUID();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function todayISO(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function startOfWeekISO(d = new Date()): string {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return todayISO(copy);
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round0(n: number): number {
  return Math.round(n);
}

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/£/g, "")
    .replace(/\s+/g, "")
    .replace(/×/g, "x")
    .replace(/\*\*/g, "^")
    .replace(/degrees/g, "")
    .replace(/°/g, "")
    .replace(/,/g, "");
}

export function answersMatch(student: string, expected: string): boolean {
  const a = normalizeAnswer(student);
  const b = normalizeAnswer(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  const variants = b.split("|").map((v) => normalizeAnswer(v));
  if (variants.includes(a)) return true;
  const numA = Number(a);
  const numB = Number(b);
  if (Number.isFinite(numA) && Number.isFinite(numB) && Math.abs(numA - numB) < 1e-6) {
    return true;
  }
  return false;
}

export const MISTAKE_CATEGORIES = [
  "concept gap",
  "method selection",
  "algebra error",
  "arithmetic error",
  "sign error",
  "formula error",
  "units",
  "rounding",
  "misreading",
  "exam technique",
  "careless error",
  "graph interpretation",
  "notation",
  "unknown",
] as const;

export type MistakeCategory = (typeof MISTAKE_CATEGORIES)[number];
