import Fastify from 'fastify';

import { createStorageDownloadUrlSigner } from '../dist/storage/signed-download-url.js';
import { registerStorageRoutes } from '../dist/storage/storage-routes.js';
import { createStorageService } from '../dist/storage/storage-service.js';
import { createFileShareTool } from '../dist/tools/file-share.js';

function createAuthContext(userId = 'user_1') {
	return {
		claims: {
			aud: 'authenticated',
			email: `${userId}@runa.local`,
			email_verified: true,
			exp: 1_900_000_000,
			iat: 1_800_000_000,
			iss: 'https://local.supabase.test/auth/v1',
			role: 'authenticated',
			session_id: `session_${userId}`,
			sub: userId,
		},
		principal: {
			kind: 'authenticated',
			provider: 'supabase',
			role: 'authenticated',
			scope: {
				tenant_id: 'tenant_1',
				workspace_id: 'workspace_1',
				workspace_ids: ['workspace_1'],
			},
			user_id: userId,
		},
		session: {
			identity_provider: 'local-proof',
			provider: 'supabase',
			scope: {
				tenant_id: 'tenant_1',
				workspace_id: 'workspace_1',
				workspace_ids: ['workspace_1'],
			},
			session_id: `session_${userId}`,
			user_id: userId,
		},
		transport: 'http',
		user: {
			email: `${userId}@runa.local`,
			email_verified: true,
			identities: [],
			primary_provider: 'supabase',
			scope: {
				tenant_id: 'tenant_1',
				workspace_id: 'workspace_1',
				workspace_ids: ['workspace_1'],
			},
			status: 'active',
			user_id: userId,
		},
	};
}

function createMemoryStorageAdapter() {
	const blobs = new Map();

	return {
		adapter: {
			async get_object(blobId) {
				return blobs.get(blobId) ?? null;
			},
			async upload_object(blob) {
				blobs.set(blob.blob_id, blob);

				return {
					blob_id: blob.blob_id,
					content_type: blob.content_type,
					created_at: blob.created_at,
					filename: blob.filename,
					kind: blob.kind,
					owner_kind: blob.owner_kind,
					owner_subject: blob.owner_subject,
					run_id: blob.run_id,
					size_bytes: blob.size_bytes,
					tenant_id: blob.tenant_id,
					trace_id: blob.trace_id,
					user_id: blob.user_id,
					workspace_id: blob.workspace_id,
				};
			},
		},
		blobs,
	};
}

async function main() {
	const authContext = createAuthContext('user_1');
	const storage = createMemoryStorageAdapter();
	const storageService = createStorageService({
		adapter: storage.adapter,
		generate_blob_id: () => 'blob_local_file_transfer_proof',
		now: () => new Date('2026-04-26T14:40:00.000Z'),
	});
	const signer = createStorageDownloadUrlSigner({
		now: () => new Date('2026-04-26T14:40:00.000Z'),
		secret: 'local-file-transfer-proof-secret',
		ttl_ms: 15 * 60 * 1000,
	});
	const server = Fastify();

	server.addHook('onRequest', async (request) => {
		request.auth = authContext;
	});
	await registerStorageRoutes(server, storageService, {
		download_url_signer: signer,
	});

	try {
		const tool = createFileShareTool();
		const shared = await tool.execute(
			{
				arguments: {
					content: '# Local file transfer proof\nSigned download is scoped and expiring.',
					filename: '../proof.md',
					mime_type: 'text/markdown',
				},
				call_id: 'call_local_file_transfer_proof',
				tool_name: 'file.share',
			},
			{
				auth_context: authContext,
				create_storage_download_url: signer.create,
				run_id: 'run_local_file_transfer_proof',
				storage_service: storageService,
				trace_id: 'trace_local_file_transfer_proof',
			},
		);

		if (shared.status !== 'success') {
			throw new Error(`file.share failed: ${JSON.stringify(shared)}`);
		}

		const downloadResponse = await server.inject({
			headers: {
				authorization: 'Bearer local-proof-token',
			},
			method: 'GET',
			url: shared.output.url,
		});
		const invalidSignatureResponse = await server.inject({
			headers: {
				authorization: 'Bearer local-proof-token',
			},
			method: 'GET',
			url: `/storage/download/${shared.output.blob_id}?expires_at=${encodeURIComponent(
				shared.output.expires_at,
			)}&signature=bad`,
		});

		let crossUserDenied = false;
		try {
			await storageService.get_blob({
				auth: createAuthContext('user_2'),
				blob_id: shared.output.blob_id,
			});
		} catch (error) {
			crossUserDenied =
				error instanceof Error && error.message.toLowerCase().includes('ownership mismatch');
		}

		if (downloadResponse.statusCode !== 200) {
			throw new Error(`Expected signed download 200, got ${downloadResponse.statusCode}.`);
		}

		if (invalidSignatureResponse.statusCode !== 403) {
			throw new Error(
				`Expected invalid signature 403, got ${invalidSignatureResponse.statusCode}.`,
			);
		}

		if (!crossUserDenied) {
			throw new Error('Expected cross-user storage access to be denied.');
		}

		console.log(
			`LOCAL_FILE_TRANSFER_PROOF ${JSON.stringify({
				blob_id: shared.output.blob_id,
				content_disposition: downloadResponse.headers['content-disposition'],
				download_status: downloadResponse.statusCode,
				expires_at: shared.output.expires_at,
				filename: shared.output.filename,
				invalid_signature_status: invalidSignatureResponse.statusCode,
				result: 'PASS',
				size_bytes: shared.output.size_bytes,
				storage_ref: shared.output.storage_ref,
				url_is_relative: shared.output.url.startsWith('/storage/download/'),
				user_scope_denied: crossUserDenied,
			})}`,
		);
	} finally {
		await server.close();
	}
}

main().catch((error) => {
	console.error(
		`LOCAL_FILE_TRANSFER_PROOF ${JSON.stringify({
			error: error instanceof Error ? error.message : String(error),
			result: 'FAIL',
		})}`,
	);
	process.exitCode = 1;
});
