import postgres from 'postgres';

const databaseUrl =
	process.env.LOCAL_DATABASE_URL ??
	process.env.DATABASE_URL ??
	'postgresql://runa:runa@localhost:5432/runa';
const sql = postgres(databaseUrl, {
	idle_timeout: 1,
	max: 1,
	onnotice: () => {},
	prepare: false,
});

const proofRole = 'runa_memory_rls_probe_user';
const selectPolicy = 'memories_select_rls_probe_policy';

async function ensureSchema() {
	await sql`
		CREATE TABLE IF NOT EXISTS memories (
			memory_id text PRIMARY KEY,
			scope text NOT NULL,
			scope_id text NOT NULL,
			status text NOT NULL,
			source_kind text NOT NULL,
			summary text NOT NULL,
			content text NOT NULL,
			retrieval_text text,
			embedding_metadata jsonb,
			source_run_id text,
			source_trace_id text,
			archived_at timestamptz,
			created_at timestamptz NOT NULL,
			updated_at timestamptz NOT NULL,
			tenant_id text,
			workspace_id text,
			user_id text
		)
	`;
	await sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS tenant_id text`;
	await sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS workspace_id text`;
	await sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS user_id text`;
}

async function scalar(query) {
	const rows = await query;
	const value = rows[0]?.count;

	return typeof value === 'number' ? value : Number(value ?? 0);
}

async function runProof() {
	const proofIds = ['proof_memory_user_a', 'proof_memory_user_b', 'proof_memory_other_tenant'];

	await ensureSchema();
	await sql
		.begin(async (transaction) => {
			await transaction`DELETE FROM memories WHERE memory_id = ANY(${proofIds})`;
			await transaction`
			INSERT INTO memories (
				memory_id,
				scope,
				scope_id,
				status,
				source_kind,
				summary,
				content,
				created_at,
				updated_at,
				tenant_id,
				workspace_id,
				user_id
			)
			VALUES
				('proof_memory_user_a', 'user', 'user_a', 'active', 'explicit', 'User A proof', 'tenant A user A memory', NOW(), NOW(), 'tenant_a', 'workspace_a', 'user_a'),
				('proof_memory_user_b', 'user', 'user_b', 'active', 'explicit', 'User B proof', 'tenant A user B memory', NOW(), NOW(), 'tenant_a', 'workspace_a', 'user_b'),
				('proof_memory_other_tenant', 'user', 'user_a', 'active', 'explicit', 'Other tenant proof', 'tenant B user A memory', NOW(), NOW(), 'tenant_b', 'workspace_b', 'user_a')
		`;
			await transaction`DROP POLICY IF EXISTS ${transaction(selectPolicy)} ON memories`;
			await transaction`DROP ROLE IF EXISTS ${transaction(proofRole)}`;
			await transaction`CREATE ROLE ${transaction(proofRole)}`;
			await transaction`GRANT USAGE ON SCHEMA public TO ${transaction(proofRole)}`;
			await transaction`GRANT SELECT ON memories TO ${transaction(proofRole)}`;
			await transaction`ALTER TABLE memories ENABLE ROW LEVEL SECURITY`;
			await transaction`ALTER TABLE memories FORCE ROW LEVEL SECURITY`;
			await transaction`
			CREATE POLICY ${transaction(selectPolicy)}
			ON memories
			FOR SELECT
			USING (
				tenant_id = current_setting('runa.tenant_id', true)
				AND user_id = current_setting('runa.user_id', true)
			)
		`;

			await transaction`SET LOCAL ROLE ${transaction(proofRole)}`;
			await transaction`SET LOCAL runa.tenant_id = 'tenant_a'`;
			await transaction`SET LOCAL runa.user_id = 'user_a'`;
			const tenantAUserAVisible = await scalar(transaction`
			SELECT count(*)::int AS count
			FROM memories
			WHERE memory_id = ANY(${proofIds})
		`);
			await transaction`SET LOCAL runa.user_id = 'user_b'`;
			const tenantAUserBVisible = await scalar(transaction`
			SELECT count(*)::int AS count
			FROM memories
			WHERE memory_id = ANY(${proofIds})
		`);
			await transaction`SET LOCAL runa.tenant_id = 'tenant_b'`;
			await transaction`SET LOCAL runa.user_id = 'user_a'`;
			const tenantBUserAVisible = await scalar(transaction`
			SELECT count(*)::int AS count
			FROM memories
			WHERE memory_id = ANY(${proofIds})
		`);
			await transaction`RESET ROLE`;

			if (tenantAUserAVisible !== 1 || tenantAUserBVisible !== 1 || tenantBUserAVisible !== 1) {
				throw new Error(
					`Unexpected RLS counts: tenantAUserA=${tenantAUserAVisible}, tenantAUserB=${tenantAUserBVisible}, tenantBUserA=${tenantBUserAVisible}`,
				);
			}

			const summary = {
				database_url_host: new URL(databaseUrl).host,
				proof_table: 'memories',
				result: 'PASS',
				rls_policy: selectPolicy,
				rollback: true,
				visible_counts: {
					tenant_a_user_a: tenantAUserAVisible,
					tenant_a_user_b: tenantAUserBVisible,
					tenant_b_user_a: tenantBUserAVisible,
				},
			};

			console.log(`LOCAL_MEMORY_RLS_PROOF ${JSON.stringify(summary)}`);
			throw new Error('__ROLLBACK_LOCAL_MEMORY_RLS_PROOF__');
		})
		.catch((error) => {
			if (error instanceof Error && error.message === '__ROLLBACK_LOCAL_MEMORY_RLS_PROOF__') {
				return;
			}

			throw error;
		});
}

runProof()
	.catch((error) => {
		console.error(
			`LOCAL_MEMORY_RLS_PROOF ${JSON.stringify({
				error: error instanceof Error ? error.message : String(error),
				result: 'FAIL',
			})}`,
		);
		process.exitCode = 1;
	})
	.finally(async () => {
		await sql.end({ timeout: 5 });
	});
