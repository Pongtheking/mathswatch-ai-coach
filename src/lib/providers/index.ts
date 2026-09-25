import type { MathsWatchProvider, ProviderAssignment, ProviderProgress, ProviderResult, ProviderTopic } from "@/lib/providers/types";

/** Student types assignment scores after working in MathsWatch. */
export class ManualProvider implements MathsWatchProvider {
  id = "manual" as const;
  name = "Manual entry";
  constructor(private rows: ProviderResult[] = []) {}
  async getAssignments(): Promise<ProviderAssignment[]> {
    return this.rows.map((r) => ({ id: r.id, title: r.title, topic: r.topic }));
  }
  async getResults(): Promise<ProviderResult[]> {
    return this.rows;
  }
  async getProgress(): Promise<ProviderProgress[]> {
    return this.rows
      .filter((r) => r.topic && r.scorePercent != null)
      .map((r) => ({ topic: r.topic!, percent: r.scorePercent }));
  }
  async getTopics(): Promise<ProviderTopic[]> {
    const names = [...new Set(this.rows.map((r) => r.topic).filter(Boolean))] as string[];
    return names.map((name) => ({ id: name.toLowerCase(), name }));
  }
}

/** Screenshot capture is the primary live workflow. */
export class ScreenshotProvider implements MathsWatchProvider {
  id = "screenshot" as const;
  name = "Screenshot capture";
  async getAssignments() {
    return [];
  }
  async getResults() {
    return [];
  }
  async getProgress() {
    return [];
  }
  async getTopics() {
    return [];
  }
}

/** CSV / JSON import of results the student already has. */
export class ImportProvider implements MathsWatchProvider {
  id = "import" as const;
  name = "File import";
  constructor(private rows: ProviderResult[] = []) {}
  async getAssignments(): Promise<ProviderAssignment[]> {
    return this.rows.map((r) => ({ id: r.id, title: r.title, topic: r.topic }));
  }
  async getResults() {
    return this.rows;
  }
  async getProgress(): Promise<ProviderProgress[]> {
    return this.rows
      .filter((r) => r.topic && r.scorePercent != null)
      .map((r) => ({ topic: r.topic!, percent: r.scorePercent }));
  }
  async getTopics(): Promise<ProviderTopic[]> {
    const names = [...new Set(this.rows.map((r) => r.topic).filter(Boolean))] as string[];
    return names.map((name) => ({ id: name.toLowerCase(), name }));
  }
}
