import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/app-shell";
import { Protected } from "@/components/layout/gate";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { addAssignment, getBootstrap, importResults, listAssignments, updateProfile } from "@/lib/server/fns";
import { AiKeyForm } from "@/components/ai-key-form";

export const Route = createFileRoute("/settings")({ component: () => <Protected><SettingsPage /></Protected> });

function SettingsPage() {
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const assigns = useQuery({ queryKey: ["assignments"], queryFn: () => listAssignments() });
  const p = boot.data?.profile;
  const [name, setName] = useState("");
  const [board, setBoard] = useState("AQA");
  const [minutes, setMinutes] = useState(180);
  const [csv, setCsv] = useState("title,topic,score,percent\nClip 1 Quadratics,Quadratics,6/10,60");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [score, setScore] = useState("");

  const save = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
  const add = useMutation({
    mutationFn: addAssignment,
    onSuccess: () => {
      toast.success("Logged");
      qc.invalidateQueries({ queryKey: ["assignments"] });
      setTitle("");
    },
  });
  const imp = useMutation({
    mutationFn: importResults,
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error);
      else toast.success(`Imported ${res.imported} rows`);
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
  });

  return (
    <div>
      <PageHeader
        kicker="Settings"
        title="Student profile"
        lede="This app never asks for a MathsWatch password. Add your own Gemini key, then log results, import a CSV, or capture screenshots."
      />
      <AiKeyForm />
      <Card className="mt-4">
        <CardTitle>Profile</CardTitle>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="dn">Display name</Label>
            <Input id="dn" defaultValue={p?.display_name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="board">Exam board</Label>
            <select
              id="board"
              className="h-11 w-full rounded-[10px] border border-border bg-bg px-3"
              defaultValue={p?.exam_board}
              onChange={(e) => setBoard(e.target.value)}
            >
              <option value="unspecified">Not set</option>
              <option value="AQA">AQA</option>
              <option value="Edexcel">Edexcel</option>
              <option value="OCR">OCR</option>
            </select>
          </div>
          <div>
            <Label htmlFor="mins">Weekly minutes goal</Label>
            <Input
              id="mins"
              type="number"
              defaultValue={p?.weekly_minutes_goal}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </div>
        </div>
        <p className="mt-3 text-sm text-fg-muted">Target grade is 9. Learning estimates stay internal.</p>
        <Button
          className="mt-4"
          onClick={() =>
            save.mutate({
              data: {
                displayName: name || p?.display_name,
                examBoard: board,
                weeklyMinutes: minutes,
                onboardingComplete: true,
              },
            })
          }
        >
          Save profile
        </Button>
      </Card>

      <Card className="mt-4">
        <CardTitle>Manual MathsWatch results</CardTitle>
        <CardHint>Provider: Manual. Paste a clip name and score after you finish work on MathsWatch.</CardHint>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Input placeholder="Assignment title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <Input placeholder="Score e.g. 7/10" value={score} onChange={(e) => setScore(e.target.value)} />
        </div>
        <Button
          className="mt-3"
          variant="outline"
          disabled={!title}
          onClick={() => add.mutate({ data: { title, topic, scoreRaw: score, provider: "manual" } })}
        >
          Log result
        </Button>
      </Card>

      <Card className="mt-4">
        <CardTitle>Import CSV</CardTitle>
        <CardHint>Provider: Import. Columns: title, topic, score, percent. No passwords. No scraping.</CardHint>
        <Textarea className="mt-3 font-mono text-sm" value={csv} onChange={(e) => setCsv(e.target.value)} />
        <Button className="mt-3" variant="outline" onClick={() => imp.mutate({ data: { csv } })}>
          Import
        </Button>
      </Card>

      {assigns.data && assigns.data.length > 0 ? (
        <Card className="mt-4">
          <CardTitle>Logged assignments</CardTitle>
          <ul className="mt-3 space-y-2 text-sm">
            {assigns.data.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 border-b border-border py-2 last:border-0">
                <span>
                  {a.title} <span className="text-fg-subtle">({a.provider})</span>
                </span>
                <span className="tabular-nums text-fg-muted">{a.score_raw ?? a.score_percent ?? "—"}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardTitle>About integrations</CardTitle>
        <p className="mt-2 text-sm text-fg-muted">
          Screenshot capture is the primary MathsWatch workflow. If an official API appears later, it can be added as a
          new provider without rebuilding the coach.
        </p>
      </Card>
    </div>
  );
}
