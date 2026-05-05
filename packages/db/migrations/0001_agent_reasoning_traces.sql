CREATE TABLE IF NOT EXISTS agent_reasoning_traces (
	trace_record_id text PRIMARY KEY,
	run_id text NOT NULL,
	trace_id text NOT NULL,
	turn_index integer NOT NULL,
	provider text NOT NULL,
	model text NOT NULL,
	reasoning_content text NOT NULL,
	created_at timestamptz NOT NULL,
	expires_at timestamptz NOT NULL,
	retention_policy text NOT NULL
);

CREATE INDEX IF NOT EXISTS agent_reasoning_traces_run_id_idx
ON agent_reasoning_traces (run_id);

CREATE INDEX IF NOT EXISTS agent_reasoning_traces_expires_at_idx
ON agent_reasoning_traces (expires_at);
