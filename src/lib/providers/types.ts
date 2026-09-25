/**
 * Flexible MathsWatch data-provider contract.
 *
 * There is no unofficial API client here. If MathsWatch later publishes a
 * legitimate integration, implement MathsWatchProvider without rewriting the
 * rest of the app. Until then the product runs on Manual, Screenshot and Import.
 */
export type ProviderAssignment = {
  id: string;
  title: string;
  topic?: string;
  due?: string;
};

export type ProviderResult = {
  id: string;
  title: string;
  topic?: string;
  scorePercent?: number;
  scoreRaw?: string;
  completedAt?: string;
};

export type ProviderProgress = {
  topic: string;
  percent?: number;
};

export type ProviderTopic = {
  id: string;
  name: string;
};

export interface MathsWatchProvider {
  id: "manual" | "screenshot" | "import" | "official";
  name: string;
  getAssignments(): Promise<ProviderAssignment[]>;
  getResults(): Promise<ProviderResult[]>;
  getProgress(): Promise<ProviderProgress[]>;
  getTopics(): Promise<ProviderTopic[]>;
}
