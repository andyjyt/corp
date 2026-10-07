"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseTakeoutFiles, type ImportList } from "@/lib/takeout/parse";
import { readTakeoutFiles } from "@/lib/takeout/read-files";

const BATCH_SIZE = 25;

type Progress = {
  done: number;
  total: number;
  current: string;
  matched: number;
  unmatched: string[];
  failedBatches: number;
  enriched: boolean;
  lists: { id: string; name: string }[];
};

type Stage =
  | { kind: "pick" }
  | { kind: "reading" }
  | { kind: "preview"; lists: ImportList[]; warnings: string[] }
  | { kind: "importing"; progress: Progress }
  | { kind: "done"; progress: Progress };

export function ImportWizard() {
  const [stage, setStage] = useState<Stage>({ kind: "pick" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stage.kind !== "importing") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stage.kind]);

  async function onFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError(null);
    setStage({ kind: "reading" });
    try {
      const files = await readTakeoutFiles([...fileList]);
      const { lists, warnings } = parseTakeoutFiles(files);
      if (!lists.length) {
        setError(
          "Didn't find any reviews or saved lists in those files. Make sure the export includes “Maps (your places)” and/or “Saved”.",
        );
        setStage({ kind: "pick" });
        return;
      }
      setSelected(new Set(lists.map((l) => l.sourceKey)));
      setStage({ kind: "preview", lists, warnings });
    } catch (err) {
      setError(`Couldn't read the files: ${(err as Error).message}`);
      setStage({ kind: "pick" });
    }
  }

  async function runImport(lists: ImportList[]) {
    const chosen = lists.filter((l) => selected.has(l.sourceKey));
    const progress: Progress = {
      done: 0,
      total: chosen.reduce((n, l) => n + l.records.length, 0),
      current: "",
      matched: 0,
      unmatched: [],
      failedBatches: 0,
      enriched: true,
      lists: [],
    };
    const update = () => setStage({ kind: "importing", progress: { ...progress } });

    for (const list of chosen) {
      progress.current = list.name;
      let listId: string | null = null;
      for (let i = 0; i < list.records.length; i += BATCH_SIZE) {
        const records = list.records.slice(i, i + BATCH_SIZE);
        update();
        const body = await postBatch({ sourceKey: list.sourceKey, name: list.name, kind: list.kind }, records);
        if (body) {
          listId = body.listId;
          progress.enriched = body.enriched;
          progress.unmatched.push(...body.unmatched);
          progress.matched += records.length - body.unmatched.length;
        } else {
          progress.failedBatches++;
        }
        progress.done += records.length;
      }
      if (listId) progress.lists.push({ id: listId, name: list.name });
    }
    setStage({ kind: "done", progress });
  }

  if (stage.kind === "pick" || stage.kind === "reading") {
    return (
      <>
        <ol className="card mt-6 list-decimal space-y-2 p-5 pl-10 text-sm marker:text-muted">
          <li>
            Open{" "}
            <a className="text-accent underline" href="https://takeout.google.com/" target="_blank" rel="noreferrer">
              takeout.google.com
            </a>{" "}
            and click <b>Deselect all</b>.
          </li>
          <li>
            Tick <b>Maps (your places)</b> for your reviews and starred places, and <b>Saved</b> for your lists (Want
            to go, Favorites and any you&apos;ve made).
          </li>
          <li>
            Click <b>Next step</b> → <b>Create export</b>. Google emails you a download link, usually within minutes.
          </li>
          <li>Download the .zip file(s) and drop them below. Several at once is fine.</li>
        </ol>
        <label
          className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-surface p-10 text-center hover:border-accent"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
        >
          <span className="font-medium">
            {stage.kind === "reading" ? "Reading your export…" : "Drop your Takeout .zip here, or click to choose"}
          </span>
          <span className="mt-1 text-sm text-muted">
            Your files are read in your browser; only the place lists are sent to the server.
          </span>
          <input
            type="file"
            className="sr-only"
            multiple
            accept=".zip,.json,.csv"
            onChange={(e) => onFiles(e.target.files)}
            disabled={stage.kind === "reading"}
          />
        </label>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </>
    );
  }

  if (stage.kind === "preview") {
    const total = stage.lists.filter((l) => selected.has(l.sourceKey)).reduce((n, l) => n + l.records.length, 0);
    return (
      <div className="mt-6">
        <h2 className="font-semibold">Found {stage.lists.length} lists</h2>
        <ul className="card mt-3 divide-y divide-line">
          {stage.lists.map((l) => (
            <li key={l.sourceKey}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  className="accent-[var(--accent)]"
                  checked={selected.has(l.sourceKey)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(l.sourceKey);
                    else next.delete(l.sourceKey);
                    setSelected(next);
                  }}
                />
                <span className="flex-1 font-medium">{l.name}</span>
                <span className="text-sm text-muted">
                  {l.records.length} place{l.records.length === 1 ? "" : "s"}
                  {l.kind === "reviews" ? ` · ${l.records.filter((r) => r.rating).length} rated` : ""}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {stage.warnings.map((w) => (
          <p key={w} className="mt-2 text-sm text-danger">
            {w}
          </p>
        ))}
        <p className="mt-3 text-sm text-muted">
          Each place is looked up on Google Maps to fill in cuisine, rating, price, hours and neighborhood. Large lists
          take a few minutes, so keep this tab open.
        </p>
        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary" disabled={!total} onClick={() => runImport(stage.lists)}>
            Import {total} places
          </button>
          <button className="btn" onClick={() => setStage({ kind: "pick" })}>
            Start over
          </button>
        </div>
      </div>
    );
  }

  const { progress } = stage;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 100;
  return (
    <div className="card mt-6 p-5">
      {stage.kind === "importing" ? (
        <>
          <p className="font-medium">
            Importing {progress.current}… {progress.done} / {progress.total}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">Keep this tab open until it finishes.</p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">Import finished</h2>
          <p className="mt-1 text-sm">
            {progress.matched} of {progress.total} places matched to Google Maps.
            {progress.unmatched.length
              ? ` ${progress.unmatched.length} need a quick fix. Open them from the “unmatched” filter on each list.`
              : ""}
          </p>
          {!progress.enriched ? (
            <p className="mt-2 text-sm text-danger">
              No Google API key is set on the server, so places were saved without cuisine, ratings or hours. Add{" "}
              <code>GOOGLE_MAPS_API_KEY</code> and import again to fill them in.
            </p>
          ) : null}
          {progress.failedBatches ? (
            <p className="mt-2 text-sm text-danger">
              {progress.failedBatches} batch(es) failed. Importing again will pick up what was missed.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {progress.lists.map((l) => (
              <Link key={l.id} href={`/lists/${l.id}`} className="btn">
                {l.name}
              </Link>
            ))}
            <Link href="/lists" className="btn btn-primary">
              All lists
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

type BatchResult = { listId: string; unmatched: string[]; enriched: boolean };

async function postBatch(list: Pick<ImportList, "sourceKey" | "name" | "kind">, records: ImportList["records"]) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list, records }),
      });
      if (res.ok) return (await res.json()) as BatchResult;
      if (res.status < 500) return null;
    } catch {
      // network hiccup — retry once
    }
  }
  return null;
}
