"use client";

import { useCallback, useEffect, useState } from "react";

import { withBase } from "@/lib/site";

interface DraftFile {
  content: string;
  sha: string;
  path: string;
}

interface Props {
  editionId: string;
  branch: string;
  en: DraftFile;
  es: DraftFile;
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; sha: string; commitUrl: string; savedAt: number }
  | { kind: "error"; message: string }
  | { kind: "conflict"; remoteSha: string | null };

interface PanelState {
  content: string;
  sha: string;
  dirty: boolean;
  state: SaveState;
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function wordCountClass(n: number): string {
  if (n > 1100) return "text-red-700";
  if (n > 850) return "text-amber-700";
  return "text-[var(--color-fg-muted)]";
}

function formatState(state: SaveState): { label: string; tone: string } {
  switch (state.kind) {
    case "idle":
      return { label: "", tone: "" };
    case "saving":
      return { label: "Saving…", tone: "text-[var(--color-fg-muted)]" };
    case "saved":
      return {
        label: `Saved · ${new Date(state.savedAt).toLocaleTimeString()}`,
        tone: "text-green-700",
      };
    case "error":
      return { label: state.message, tone: "text-red-700" };
    case "conflict":
      return { label: "Branch moved — reload to merge by hand.", tone: "text-red-700" };
  }
}

export function DraftEditor({ editionId, branch, en, es }: Props) {
  const [enPanel, setEnPanel] = useState<PanelState>({
    content: en.content,
    sha: en.sha,
    dirty: false,
    state: { kind: "idle" },
  });
  const [esPanel, setEsPanel] = useState<PanelState>({
    content: es.content,
    sha: es.sha,
    dirty: false,
    state: { kind: "idle" },
  });

  const anyDirty = enPanel.dirty || esPanel.dirty;

  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (!anyDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [anyDirty]);

  const save = useCallback(
    async (language: "en" | "es") => {
      const panel = language === "en" ? enPanel : esPanel;
      const setPanel = language === "en" ? setEnPanel : setEsPanel;

      setPanel((p) => ({ ...p, state: { kind: "saving" } }));

      try {
        const res = await fetch(withBase(`/api/admin/drafts/${editionId}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language,
            content: panel.content,
            sha: panel.sha,
          }),
        });
        const json = await res.json().catch(() => ({}));

        if (res.status === 409) {
          setPanel((p) => ({
            ...p,
            state: { kind: "conflict", remoteSha: (json?.remoteSha as string | null) ?? null },
          }));
          return;
        }
        if (!res.ok) {
          const message = (json?.error as string) ?? `Save failed (HTTP ${res.status})`;
          setPanel((p) => ({ ...p, state: { kind: "error", message } }));
          return;
        }

        const newSha = json.newSha as string;
        const commitUrl = json.commitUrl as string;
        setPanel((p) => ({
          ...p,
          sha: newSha,
          dirty: false,
          state: { kind: "saved", sha: newSha, commitUrl, savedAt: Date.now() },
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setPanel((p) => ({ ...p, state: { kind: "error", message } }));
      }
    },
    [editionId, enPanel, esPanel],
  );

  return (
    <div className="space-y-10">
      {renderPanel("EN", enPanel, setEnPanel, save, "en", branch)}
      {renderPanel("ES", esPanel, setEsPanel, save, "es", branch)}
    </div>
  );
}

function renderPanel(
  label: string,
  panel: PanelState,
  setPanel: (updater: (p: PanelState) => PanelState) => void,
  save: (lang: "en" | "es") => void,
  lang: "en" | "es",
  branch: string,
) {
  const words = countWords(panel.content);
  const status = formatState(panel.state);
  const conflict = panel.state.kind === "conflict";

  return (
    <article className="border border-[var(--color-line)] rounded-md p-4 bg-white">
      <header className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xl font-display">{label}</h2>
          <p className="text-xs text-[var(--color-fg-muted)]">
            <code>drafts/{branch.split("/").pop()}-{lang}.md</code>
            {" · "}
            <span className="font-mono">{panel.sha.slice(0, 7)}</span>
            {panel.dirty ? <span className="ml-2 text-amber-700">· unsaved</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm ${wordCountClass(words)}`}>{words} words</span>
          <button
            type="button"
            onClick={() => save(lang)}
            disabled={panel.state.kind === "saving" || !panel.dirty}
            className="px-4 py-2 rounded bg-[var(--color-fg)] text-[var(--color-bg)] text-sm font-semibold disabled:opacity-40"
          >
            {panel.state.kind === "saving" ? "Saving…" : `Save ${label}`}
          </button>
        </div>
      </header>

      {conflict ? (
        <div className="mb-3 p-3 border border-red-300 bg-red-50 rounded text-sm">
          <p className="font-semibold text-red-800">Branch moved.</p>
          <p className="text-red-700">
            Someone else committed to <code>{branch}</code> after you opened this editor.
            {panel.state.kind === "conflict" && panel.state.remoteSha
              ? ` Remote SHA is now ${panel.state.remoteSha.slice(0, 7)}.`
              : ""}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 px-3 py-1 rounded bg-red-700 text-white text-sm"
          >
            Reload page
          </button>
        </div>
      ) : null}

      <textarea
        value={panel.content}
        onChange={(e) =>
          setPanel((p) => ({
            ...p,
            content: e.target.value,
            dirty: true,
            state: p.state.kind === "saved" ? { kind: "idle" } : p.state,
          }))
        }
        rows={32}
        spellCheck={true}
        className="w-full font-mono text-sm leading-relaxed p-3 border border-[var(--color-line)] rounded bg-[var(--color-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-fg)]"
      />

      {status.label ? (
        <p className={`mt-2 text-sm ${status.tone}`}>
          {status.label}
          {panel.state.kind === "saved" ? (
            <>
              {" · "}
              <a
                href={panel.state.commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                view commit
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </article>
  );
}
