import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getBootstrap, saveGeminiKey } from "@/lib/server/fns";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/feedback";

export function AiKeyForm({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const [key, setKey] = useState("");
  const save = useMutation({
    mutationFn: saveGeminiKey,
    onSuccess: (res) => {
      if (!res.ok) return;
      toast.success("This key is real. AI marking is ready on your account.");
      setKey("");
      qc.invalidateQueries({ queryKey: ["bootstrap"] });
      qc.invalidateQueries({ queryKey: ["papers"] });
    },
    onError: () => toast.error("Could not check that key. Try again."),
  });

  const configured = Boolean(boot.data?.geminiKey?.configured);
  const suffix = boot.data?.geminiKey?.suffix;

  const fields = (
    <>
      {configured ? (
        <p className="mt-3 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">
          A working key ending …{suffix} is saved for your account.
        </p>
      ) : (
        <p className="mt-3 rounded-lg bg-warn/15 px-3 py-2 text-sm">
          No key yet. You cannot mark papers until you add a real one.
        </p>
      )}
      <Input
        className="mt-3 font-mono"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="Paste Gemini API key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      <Button
        className="mt-3"
        disabled={!key.trim() || save.isPending}
        onClick={() => save.mutate({ data: { key } })}
      >
        {save.isPending ? "Checking with Google…" : configured ? "Replace and test key" : "Save and test key"}
      </Button>
      {save.data && !save.data.ok ? (
        <ErrorBanner className="mt-3" message={save.data.error} />
      ) : null}
      <p className="mt-3 text-xs text-fg-subtle">
        Create a key at aistudio.google.com/apikey. Copy the whole string. Fake or partial keys are rejected.
      </p>
    </>
  );

  if (compact) {
    return (
      <div id="ai-key">
        <p className="font-display text-lg">Paste your Gemini API key</p>
        {fields}
      </div>
    );
  }

  return (
    <Card id="ai-key">
      <CardTitle>{configured ? "Your Gemini API key" : "Add a Gemini API key"}</CardTitle>
      <CardHint>
        Each student uses their own key. The app asks Google if the key is real before saving it.
        Get one free from Google AI Studio — it should start with AQ. or AIza.
      </CardHint>
      {fields}
    </Card>
  );
}
