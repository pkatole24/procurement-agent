"use client";
import { useCallback, useEffect, useState } from "react";
import Markdown from "./markdown";
import RunMeasures, { type ModelStep } from "./run-measures";
import type { Run } from "../lib/domain";

type Detail = {
  run: Run;
  artifacts: { name: string }[];
  events: { id: number; role: string; message: string; created_at: string }[];
  usage: ModelStep[];
  risks: { id: string; risk: string }[];
};
export default function Workspace({
  readiness,
}: {
  readiness: { ready: boolean; missing: string[] };
}) {
  const [runs, setRuns] = useState<Run[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [doc, setDoc] = useState(""),
    [choices, setChoices] = useState<
      Record<string, { decision: string; comment: string }>
    >({}),
    [returnReason, setReturnReason] = useState("");
  const load = useCallback(async (id?: string) => {
    const response = await fetch(id ? `/api/runs/${id}` : "/api/runs", {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load workspace");
    if (id) setDetail(data);
    else setRuns(data.runs);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    if (!detail) return;
    const timer = setInterval(
      () => load(detail.run.id).catch((e) => setError(e.message)),
      6000,
    );
    return () => clearInterval(timer);
  }, [detail?.run.id, load]);
  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        detail ? `/api/runs/${detail.run.id}` : "/api/runs",
        {
          method: detail ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            version: detail?.run.version,
            ...payload,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed");
      await load(data.id || detail?.run.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }
  async function open(name: string) {
    const response = await fetch(
      `/api/runs/${detail!.run.id}/artifacts?name=${encodeURIComponent(name)}`,
    );
    if (!response.ok) {
      setError("Unable to read artifact");
      return;
    }
    setDoc(await response.text());
  }
  return (
    <>
      <div className="readiness">
        <span className={`status-dot ${readiness.ready ? "" : "amber"}`} />
        <strong>
          {readiness.ready
            ? "Live harness configured"
            : "Live execution is not enabled"}
        </strong>
        {!readiness.ready && (
          <details>
            <summary>Required setup</summary>
            <ul>
              {readiness.missing.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="workspace-grid">
        <aside className="run-list">
          <button
            disabled={!readiness.ready || busy}
            className="button"
            onClick={() => {
              setDetail(null);
              setChoices({});
              setDoc("");
            }}
          >
            New audit
          </button>
          {!detail && (
            <button
              className="button secondary"
              disabled={!readiness.ready || busy}
              onClick={() => act("start", { id: crypto.randomUUID() })}
            >
              {busy ? "Starting…" : "Start rule extraction →"}
            </button>
          )}
          <h3>Saved runs</h3>
          {runs.map((run) => (
            <button
              key={run.id}
              className={`run-item ${detail?.run.id === run.id ? "selected" : ""}`}
              onClick={() => {
                setChoices({});
                setDoc("");
                load(run.id).catch((e) => setError(e.message));
              }}
            >
              <strong>
                WBC · {new Date(run.created_at).toLocaleDateString()}
              </strong>
              <span>
                {run.stage} · {run.id.slice(0, 8)}
              </span>
            </button>
          ))}
        </aside>
        <div>
          {detail ? (
            <>
              <div className="section-heading">
                <h2>{detail.run.stage.replaceAll("-", " ")}</h2>
                <span className="badge">Pack v{detail.run.pack_version}</span>
              </div>
              <p className="muted">
                Each run has its own evidence workspace. Approval is bound to
                the displayed version.
              </p>
              <RunMeasures run={detail.run} steps={detail.usage} events={detail.events} />
              {detail.run.data.error && (
                <p className="notice">{detail.run.data.error}</p>
              )}
              {detail.run.stage === "risk-review" && (
                <div className="decision-panel">
                  <h3>Risk decisions</h3>
                  <p>
                    Review the register, then decide every risk. Requested
                    changes need a comment.
                  </p>
                  {detail.risks.map((risk) => (
                    <div className="risk-decision" key={risk.id}>
                      <label htmlFor={`decision-${risk.id}`}>
                        <strong>{risk.id}</strong> {risk.risk}
                      </label>
                      <select
                        id={`decision-${risk.id}`}
                        value={choices[risk.id]?.decision || ""}
                        onChange={(e) =>
                          setChoices({
                            ...choices,
                            [risk.id]: {
                              comment: choices[risk.id]?.comment || "",
                              decision: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">Choose a decision</option>
                        {["Approve", "Reject", "Change"].map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                      <textarea
                        aria-label={`Comment for ${risk.id}`}
                        placeholder="Reason or requested change"
                        value={choices[risk.id]?.comment || ""}
                        onChange={(e) =>
                          setChoices({
                            ...choices,
                            [risk.id]: {
                              decision: choices[risk.id]?.decision || "",
                              comment: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                  <button
                    className="button"
                    disabled={
                      busy ||
                      !readiness.ready ||
                      detail.risks.some((r) => !choices[r.id]?.decision)
                    }
                    onClick={() =>
                      act("decisions", {
                        decisions: detail.risks.map((r) => ({
                          id: r.id,
                          ...choices[r.id],
                        })),
                      })
                    }
                  >
                    Submit decisions and build revision →
                  </button>
                </div>
              )}
              {detail.run.stage === "signoff" && (
                <form
                  className="decision-panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    act("signoff", {
                      packVersion: detail.run.pack_version,
                      comments: data.get("comments"),
                    });
                  }}
                >
                  <h3>Final auditor sign-off</h3>
                  <p>
                    Inspect the pack, challenge log and QA review before
                    signing. Your identity and the server timestamp will be
                    recorded.
                  </p>
                  <textarea
                    name="comments"
                    aria-label="Sign-off comments"
                    placeholder="Comments (optional)"
                  />
                  <button className="button" disabled={busy}>
                    Sign off pack v{detail.run.pack_version}
                  </button>
                  <hr />
                  <label htmlFor="return-reason">Or return the pack to the team</label>
                  <textarea id="return-reason" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="Describe the correction required" />
                  <button type="button" className="button secondary" disabled={busy || !returnReason.trim() || !readiness.ready} onClick={() => act('return', { packVersion: detail.run.pack_version, reason: returnReason })}>Request a team revision</button>
                </form>
              )}
              {["paused", "blocked"].includes(detail.run.stage) && (
                <button
                  disabled={busy || !readiness.ready}
                  className="button"
                  onClick={() => act("retry")}
                >
                  Retry saved stage →
                </button>
              )}
              <div className="artifact-links">
                {detail.artifacts
                  .filter((a) => !a.name.startsWith("analytics-full/"))
                  .map((a) => (
                    <span key={a.name}>
                      <button onClick={() => open(a.name)}>{a.name}</button>
                      <a
                        href={`/api/runs/${detail.run.id}/artifacts?name=${encodeURIComponent(a.name)}&download=1`}
                        aria-label={`Download ${a.name}`}
                      >
                        ↓
                      </a>
                    </span>
                  ))}
              </div>
              {doc && (
                <div className="artifact-view">
                  <button className="text-link" onClick={() => setDoc("")}>
                    Close document ×
                  </button>
                  {doc.trim().startsWith("{") ? (
                    <pre>{doc}</pre>
                  ) : (
                    <Markdown text={doc} />
                  )}
                </div>
              )}
              <details className="activity" open>
                <summary>Agent activity and team messages</summary>
                {detail.events.map((item) => (
                  <div key={item.id}>
                    <span className="badge">{item.role}</span>
                    <time className="activity-time" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
                    <pre>{item.message}</pre>
                  </div>
                ))}
              </details>
              {!["signed-off", "cancelled"].includes(detail.run.stage) && (
                <button
                  className="text-link danger"
                  disabled={busy}
                  onClick={() => act("cancel")}
                >
                  Cancel this run
                </button>
              )}
            </>
          ) : (
            <div className="empty-state">
              <h2>Start with the evidence.</h2>
              <p>
                A fresh run begins with rule extraction from the existing WBC
                sources, followed by analysis, risk review and the planning
                team. Completed-example decisions are never copied into a new
                run.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
