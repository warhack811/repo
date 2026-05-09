import { describe, expect, it } from 'vitest';

import {
	computeWorkspaceAttestationId,
	validateWorkspaceAttestation,
} from './workspace-attestation.js';

describe('workspace attestation', () => {
	it('computes the same attestation id for case and slash variants of the same path', () => {
		const first = computeWorkspaceAttestationId('D:\\AI\\Runa');
		const second = computeWorkspaceAttestationId('d:/ai/runa');

		expect(first).toBe(second);
		expect(first).toHaveLength(16);
	});

	it('allows websocket handshakes when workspace attestation query is missing', () => {
		const validation = validateWorkspaceAttestation(
			{
				url: '/ws?access_token=test-token',
			},
			'workspace-id',
		);

		expect(validation).toBeUndefined();
	});

	it('rejects websocket handshakes when workspace attestation query mismatches', () => {
		const validation = validateWorkspaceAttestation(
			{
				url: '/ws?access_token=test-token&workspace_id=wrong-id',
			},
			'expected-id',
		);

		expect(validation).toMatchObject({
			code: 'WORKSPACE_ATTESTATION_MISMATCH',
		});
	});
});
