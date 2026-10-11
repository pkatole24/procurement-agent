CREATE TABLE IF NOT EXISTS audit_runs (
  id uuid PRIMARY KEY,
  owner text NOT NULL,
  stage text NOT NULL,
  version integer NOT NULL DEFAULT 0,
  pack_version integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS audit_one_executing ON audit_runs ((true))
  WHERE stage IN ('extracting','analysing','assessing','revising','planning');
CREATE TABLE IF NOT EXISTS audit_artifacts (
  run_id uuid NOT NULL REFERENCES audit_runs(id),
  name text NOT NULL,
  url text NOT NULL,
  sha256 text NOT NULL,
  version integer NOT NULL,
  PRIMARY KEY(run_id, name)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES audit_runs(id),
  role text NOT NULL,
  message text NOT NULL,
  operation_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, operation_key)
);
CREATE TABLE IF NOT EXISTS audit_operations (
  run_id uuid NOT NULL REFERENCES audit_runs(id),
  operation_key text NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY(run_id, operation_key)
);
CREATE TABLE IF NOT EXISTS audit_mail (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES audit_runs(id),
  sender text NOT NULL,
  recipient text NOT NULL,
  message text NOT NULL,
  operation_key text NOT NULL,
  delivered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, operation_key)
);
CREATE TABLE IF NOT EXISTS audit_sessions (
  run_id uuid NOT NULL REFERENCES audit_runs(id),
  role text NOT NULL,
  session_id text NOT NULL,
  PRIMARY KEY(run_id, role)
);
CREATE TABLE IF NOT EXISTS audit_model_steps (
  run_id uuid NOT NULL REFERENCES audit_runs(id),
  role text NOT NULL,
  turn_id text NOT NULL,
  step_index integer NOT NULL,
  generation_id text,
  cost_usd numeric,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(run_id, role, turn_id, step_index)
);
