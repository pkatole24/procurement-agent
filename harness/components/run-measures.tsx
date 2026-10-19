"use client";
import { useEffect, useState } from 'react';
import type { Run } from '../lib/domain';

export type ModelStep = {
  role: string;
  turn_id: string;
  step_index: number;
  generation_id: string | null;
  cost_usd: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
};

const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 });

export default function RunMeasures({ run, steps, events }: { run: Run; steps: ModelStep[]; events: { message: string; created_at: string }[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const finishedAt = run.stage === 'signed-off' ? run.data.signoff?.date : run.stage === 'cancelled' ? events.find(e => e.message.startsWith('Cancelled by'))?.created_at : null;
  const seconds = Math.max(0, Math.floor(((finishedAt ? Date.parse(finishedAt) : now) - Date.parse(run.created_at)) / 1000));
  const elapsed = `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`;
  const spent = steps.reduce((total, step) => total + (step.cost_usd == null ? 0 : Number(step.cost_usd)), 0);
  const unpriced = steps.filter(step => step.cost_usd == null).length;
  return <>
    <div className="run-measures" aria-label="Run time and model spending">
      <div><span>Elapsed since start</span><strong>{elapsed}</strong><small>Includes time waiting for auditor decisions.</small></div>
      <div><span>Recorded AI model cost</span><strong>{money(spent)}</strong><small>{steps.length} completed calls{unpriced ? ` · ${unpriced} awaiting cost` : ''}</small></div>
      <div><span>Project ceiling</span><strong>$4.00</strong><small>Vercel budget, no reset</small></div>
    </div>
    <details className="usage-details"><summary>Model call ledger</summary>
      {steps.length ? steps.map(step => <div key={`${step.role}:${step.turn_id}:${step.step_index}`}>
        <span>{new Date(step.created_at).toLocaleString()} · {step.role}</span>
        <strong>{step.cost_usd == null ? 'Cost pending' : money(Number(step.cost_usd))}</strong>
        <small>{step.input_tokens ?? '—'} input · {step.output_tokens ?? '—'} output tokens{step.generation_id ? ` · ${step.generation_id}` : ''}</small>
      </div>) : <p>No model calls recorded yet.</p>}
    </details>
  </>;
}
